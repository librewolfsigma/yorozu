// Iwara — user-mandated HMV source (api.iwara.tv).
//
// VERIFIED from sandbox (2026-11, keyless guest access):
//  - GET https://api.iwara.tv/videos?limit=24&page=0&sort=date  → 200 JSON
//    {count, limit, page, results:[{id, slug, title, body, rating, file:{id,
//    duration, width, height}, numLikes, numViews, user:{name}, …}]}
//    REQUIRES browser UA + Referer https://www.iwara.tv/ — plain server UAs
//    get Cloudflare 403 (verified: header set below returns 200).
//  - sort works: date | likes | views. page is 0-BASED.
//  - GET /video/{id} → full object incl. `fileUrl` — a SIGNED direct MP4 on
//    files{,q}.iwara.tv (expires=…&hash=…) → verified playable.
//  - Thumbnails: https://files.iwara.tv/image/thumbnail/{file.id}/thumbnail-{NN}.jpg
//    (verified 200 image/jpeg; NN = `thumbnail` field, zero-padded).
//  - Guest (no account) API ignores the `search` param — text search is NOT
//    faked; browse/sort/pagination is the keyless path. Explicit-rated videos
//    need a platform account upstream; guest sees what Iwara serves guests.
//
// User directive: HMV = HMVmania + Iwara ONLY. Everything Iwara serves lands
// in the HMV slice — Iwara is the HMV community platform.

import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";
import { liveJson, LiveFetchError, curlText, BROWSER_UA } from "./http";

const BASE = "https://api.iwara.tv";
const IW_HEADERS: Record<string, string> = {
  Referer: "https://www.iwara.tv/",
  Origin: "https://www.iwara.tv",
  Accept: "application/json",
};

interface IwFile {
  id: string;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
  mime?: string;
}

interface IwVideo {
  id: string;
  slug?: string;
  title: string;
  body?: string | null;
  rating?: string; // ecchi | explicit | …
  file?: IwFile;
  thumbnail?: number;
  numLikes?: number;
  numViews?: number;
  createdAt?: string;
  tags?: { id: string; label?: string }[] | string[];
  user?: { username?: string; name?: string } | null;
  fileUrl?: string | null;
}

async function iwJson<T>(url: string): Promise<T> {
  try {
    return await liveJson<T>(url, { ua: BROWSER_UA, headers: IW_HEADERS, timeoutMs: 15_000 });
  } catch (e) {
    if (e instanceof LiveFetchError && (e.status === 403 || e.status === 503 || e.status === 429)) {
      const text = await curlText(url, {
        ua: BROWSER_UA,
        timeoutMs: 18_000,
      });
      // curlJson sends Accept: application/json but no Referer — use curlText
      // through the same path by parsing here (Referer matters for iwara).
      return JSON.parse(text) as T;
    }
    throw e;
  }
}

function thumbUrl(v: IwVideo): string | null {
  const fid = v.file?.id;
  if (!fid) return null;
  const n = typeof v.thumbnail === "number" ? String(Math.max(0, v.thumbnail)).padStart(2, "0") : "00";
  return `https://files.iwara.tv/image/thumbnail/${fid}/thumbnail-${n}.jpg`;
}

function tagList(v: IwVideo): string[] {
  if (!Array.isArray(v.tags)) return [];
  return v.tags
    .map((t) => (typeof t === "string" ? t : t.label ?? t.id))
    .filter(Boolean) as string[];
}

function toItem(v: IwVideo): LiveSearchItem {
  return {
    externalId: v.id,
    title: v.title,
    description: v.body?.slice(0, 800) || null,
    coverUrl: thumbUrl(v),
    category: "AV",
    videoKind: "HMV",
    format: "HMV",
    year: v.createdAt ? new Date(v.createdAt).getUTCFullYear() : null,
    popularity: v.numViews ?? undefined,
    tags: tagList(v),
    creator: v.user?.name ?? v.user?.username ?? null,
    externalUrl: `https://www.iwara.tv/video/${v.id}`,
    episodesCount: 1,
    extra: {
      source: "iwara",
      durationSec: v.file?.duration ?? null,
      rating: v.rating ?? null,
    },
  };
}

export const iwaraAdapter: LiveAdapter = {
  id: "iwara",
  integration:
    "Iwara public API (api.iwara.tv) — keyless guest access to video listings (date/likes/views sort, pagination) and per-video detail with the platform's own signed direct MP4 (fileUrl). No login, DRM or paywall bypassed; guest scope is what Iwara serves anonymously.",

  async ping() {
    const j = await iwJson<{ results?: IwVideo[] }>(`${BASE}/videos?limit=1&page=0`);
    if (!j.results) throw new Error("iwara: API answered without results");
  },

  async search() {
    // VERIFIED (2026-11): the guest (keyless) API ignores the `search` param
    // entirely — a nonsense query returns the same default listing. Text
    // search is honestly unavailable without an account; browse/sort is the
    // real keyless surface.
    throw new Error("Iwara's guest API does not support text search upstream — browse the listings instead");
  },

  async popular(opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const sort = opts?.kind === "HMV_LIKES" ? "likes" : "date";
    const j = await iwJson<{ results?: IwVideo[] }>(
      `${BASE}/videos?limit=24&page=${page - 1}&sort=${sort}`,
    );
    return (j.results ?? []).map(toItem);
  },

  async details(externalId) {
    const v = await iwJson<IwVideo>(`${BASE}/video/${encodeURIComponent(externalId)}`);
    if (!v?.id) return null;
    const item = toItem(v);
    item.score = v.numLikes && v.numViews ? Math.min(10, (v.numLikes / Math.max(1, v.numViews)) * 50) : null;
    return item;
  },

  async units(externalId): Promise<LiveUnits> {
    const v = await iwJson<IwVideo & { fileUrl?: string | null }>(
      `${BASE}/video/${encodeURIComponent(externalId)}`,
    );
    if (!v?.fileUrl) throw new Error("iwara: no signed fileUrl returned for this video");
    // VERIFIED: fileUrl answers a JSON array of quality variants
    // [{id, name:"360", src:{view:"//asta.iwara.tv/view?…&expires=…"}}] —
    // the playable URL is https: + the src.view of the chosen variant.
    const variants = await iwJson<
      { id: string; name?: string; src?: { view?: string; download?: string } }[]
    >(v.fileUrl.startsWith("//") ? `https:${v.fileUrl}` : v.fileUrl);
    if (!Array.isArray(variants) || !variants.length) {
      throw new Error("iwara: fileUrl returned no stream variants");
    }
    const numeric = (name?: string) => parseInt(name ?? "0", 10) || 0;
    const best = [...variants].sort((a, b) => numeric(b.name) - numeric(a.name))[0];
    const view = best.src?.view ?? best.src?.download;
    if (!view) throw new Error("iwara: no view/download URL in stream variants");
    return {
      episodes: [
        {
          number: 1,
          title: v.title,
          streamUrl: view.startsWith("//") ? `https:${view}` : view,
          streamType: v.file?.mime ?? "video/mp4",
          thumbnailUrl: thumbUrl(v),
          durationSec: v.file?.duration ?? null,
        },
      ],
    };
  },
};
