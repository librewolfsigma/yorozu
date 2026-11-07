// r18.dev — the official-ish JAV metadata relaunch (CC0 structured data).
// Public keyless JSON lookups by DVD code + official free trailer MP4s.
//
// VERIFIED from sandbox (2026-11):
//  - GET https://r18.dev/videos/vod/movies/detail/-/dvd_id=MIDE-500/json
//      → 200 application/json: {actresses[{name}],categories[{name}],
//        content_id,director,images.jacket_image.large2,label,maker,
//        release_date,runtime_minutes,sample.high (trailer mp4),series,title}
//  - unknown codes → clean 404 (easy miss handling)
//  - covers on pics.dmm.co.jp, trailers on cc3001.dmm.co.jp (public)
// There is NO upstream text-search endpoint — this adapter is code-lookup
// only (pair with JavDB for code discovery). Full video streams are NOT
// offered upstream; the OFFICIAL trailer plays in-app.

import { liveJson } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

const BASE = "https://r18.dev";

interface R18Movie {
  actresses?: { name?: string; romaji?: string }[];
  categories?: { name?: string }[];
  content_id?: string;
  director?: string;
  images?: { jacket_image?: { large2?: string; large?: string } };
  label?: { name?: string };
  maker?: { name?: string };
  release_date?: string;
  runtime_minutes?: number;
  sample?: { high?: string; other?: { high?: string }[] };
  series?: { name?: string };
  title?: string;
}

const DVD_CODE_RE = /^([a-z]{2,7})-?(\d{2,6})$/i;

/** Normalize any "MIDE500"/"mide-500" spelling to the canonical MIDE-500. */
export function normalizeDvdCode(raw: string): string | null {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9-]{3,16}$/.test(t)) return null;
  const m = t.match(/^([A-Z]{2,7})-?(\d{2,6})$/);
  if (!m) return /^[A-Z]{2,7}-\d{2,6}$/.test(t) ? t : null;
  return `${m[1]}-${m[2]}`;
}

async function lookup(code: string): Promise<R18Movie | null> {
  try {
    const j = await liveJson<R18Movie>(
      `${BASE}/videos/vod/movies/detail/-/dvd_id=${encodeURIComponent(code)}/json`,
      { cacheKey: `r18:${code}`, timeoutMs: 12_000 },
    );
    return j?.content_id ? j : null;
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

function toItem(m: R18Movie, code: string): LiveSearchItem {
  return {
    externalId: code,
    title: m.title ?? code,
    coverUrl: m.images?.jacket_image?.large2 ?? m.images?.jacket_image?.large ?? null,
    category: "AV",
    videoKind: "JAV",
    format: "JAV (metadata + official trailer)",
    studio: m.maker?.name ?? null,
    creator: m.actresses?.map((a) => a.name ?? a.romaji).filter(Boolean).join(", ") || null,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    tags: (m.categories ?? []).map((c) => c.name).filter(Boolean).slice(0, 24) as string[],
    externalUrl: `https://www.r18.com/videos/vod/movies/detail/-/dvd_id=${encodeURIComponent(code)}`,
    extra: {
      source: "r18dev",
      dvdCode: code,
      runtimeMin: m.runtime_minutes,
      label: m.label?.name,
      series: m.series?.name,
      director: m.director,
      durationSec: m.runtime_minutes ? m.runtime_minutes * 60 : null,
    },
  };
}

export const r18devAdapter: LiveAdapter = {
  id: "r18dev",
  integration:
    "r18.dev public CC0 JSON metadata API — exact DVD-code lookups (actresses, maker, label, categories, cover) plus the OFFICIAL free trailer MP4 served by DMM's public CDN. There is no upstream text-search; pair with JavDB for code discovery. Full videos are not offered upstream and are never faked.",

  async ping() {
    const m = await lookup("MIDE-500");
    if (!m) throw new Error("r18.dev: reference lookup failed");
  },

  async search(q) {
    const code = normalizeDvdCode(q);
    if (!code) return []; // honest: no upstream text search exists
    const m = await lookup(code);
    return m ? [toItem(m, code)] : [];
  },

  async details(externalId) {
    const code = normalizeDvdCode(externalId) ?? externalId.toUpperCase();
    const m = await lookup(code);
    return m ? toItem(m, code) : null;
  },

  async units(externalId): Promise<LiveUnits | null> {
    const code = normalizeDvdCode(externalId) ?? externalId.toUpperCase();
    const m = await lookup(code);
    const trailer = m?.sample?.high ?? m?.sample?.other?.[0]?.high ?? null;
    if (!trailer) return null;
    return {
      episodes: [
        {
          number: 1,
          title: "Official trailer",
          streamUrl: trailer,
          streamType: "mp4",
          thumbnailUrl: m?.images?.jacket_image?.large2 ?? m?.images?.jacket_image?.large ?? null,
          durationSec: null,
          summary: "Official free trailer served by DMM's public CDN (via r18.dev). The full film is not offered upstream — open the JAVDB/source link below for your own copy.",
        },
      ],
    };
  },
};
