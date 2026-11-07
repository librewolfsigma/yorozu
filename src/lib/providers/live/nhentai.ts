// nhentai — official public JSON API v2 (user-mandated manga source).
//
// VERIFIED from sandbox (2026-11, keyless):
//  - GET https://nhentai.net/api/v2/galleries?page=1&per_page=24  → 200 JSON
//    {result:[{id,media_id,title{english,japanese},cover,tags[],num_pages,…}],
//     page, perPage, total, totalPages}
//  - GET /galleries?query={q}&page={n} → same shape (text search)
//  - GET /galleries/popular → one unpaged page of currently popular galleries
//  - GET /galleries/{id} → full detail incl. pages[]:
//        {number, path:"galleries/{media_id}/{n}.webp", width, height, thumbnail}
//  - GET /cdn → {image_servers:["https://i1.nhentai.net",…],
//                thumb_servers:["https://t1.nhentai.net",…]}
//    → real page URL = image_server + "/" + page.path   (verified 200 image/webp)
//
// A single gallery reads as one chapter whose pages are the gallery pages —
// same reader flow as E-Hentai galleries. TAXONOMY: user assigned nhentai to
// MANGA; galleries carry their own category tags (manga / doujinshi / artistcg)
// which are surfaced in the tag list. Nothing is re-hosted: pages are fetched
// from the site's own image servers through Yozora's proxy at view time.

import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";
import { liveJson, curlText, BROWSER_UA, LiveFetchError } from "./http";

const BASE = "https://nhentai.net/api/v2";

interface NhTag {
  id: number;
  name: string;
  type: string; // tag | artist | group | parody | character | language | category
  count?: number;
}

interface NhImage {
  path: string;
  width?: number;
  height?: number;
  thumbnail?: string;
}

interface NhGallery {
  id: number;
  media_id: string;
  // Detail shape: nested title{english,japanese,pretty}. LIST shape: flat
  // english_title / japanese_title (+ thumbnail path instead of cover).
  title?: { english: string | null; japanese: string | null; pretty: string | null };
  english_title?: string | null;
  japanese_title?: string | null;
  cover?: NhImage;
  thumbnail?: NhImage | string;
  pages?: NhImage[];
  tags?: NhTag[];
  tag_ids?: number[];
  num_pages?: number;
  num_favorites?: number;
  scanlator?: string | null;
  upload_date?: number; // unix seconds
}

interface NhList {
  result: NhGallery[];
  page?: number;
  totalPages?: number;
  total?: number;
}

// nhentai's edge occasionally challenges non-browser TLS fingerprints —
// same URL, same UA, retried through system curl (see http.ts notes).
async function nhJson<T>(url: string): Promise<T> {
  try {
    return await liveJson<T>(url, { ua: BROWSER_UA, headers: { Referer: "https://nhentai.net/" }, timeoutMs: 15_000 });
  } catch (e) {
    if (e instanceof LiveFetchError && (e.status === 403 || e.status === 503 || e.status === 429)) {
      const text = await curlText(url, { ua: BROWSER_UA, timeoutMs: 18_000 });
      return JSON.parse(text) as T;
    }
    throw e;
  }
}

// CDN endpoints (image/thumb servers) are stable but re-read occasionally.
let serversCache: { at: number; images: string[]; thumbs: string[] } | null = null;
async function servers(): Promise<{ images: string[]; thumbs: string[] }> {
  if (serversCache && Date.now() - serversCache.at < 30 * 60 * 1000) return serversCache;
  try {
    const j = await nhJson<{ image_servers: string[]; thumb_servers?: string[] }>(`${BASE}/cdn`);
    serversCache = { at: Date.now(), images: j.image_servers?.length ? j.image_servers : ["https://i.nhentai.net"], thumbs: j.thumb_servers?.length ? j.thumb_servers : ["https://t.nhentai.net"] };
  } catch {
    // Known-good defaults if the CDN endpoint is unreachable
    serversCache = { at: Date.now(), images: ["https://i.nhentai.net"], thumbs: ["https://t.nhentai.net"] };
  }
  return serversCache;
}

function titleOf(g: NhGallery): string {
  return (
    g.title?.english || g.title?.japanese || g.title?.pretty ||
    g.english_title || g.japanese_title ||
    `Gallery ${g.id}`
  );
}

function tagNames(g: NhGallery, type?: string): string[] {
  return (g.tags ?? []).filter((t) => !type || t.type === type).map((t) => t.name);
}

async function toItem(g: NhGallery, withCover: boolean): Promise<LiveSearchItem> {
  let coverUrl: string | null = null;
  if (withCover) {
    const s = await servers();
    // Detail shape: cover.path (…/cover.webp.webp). List shape: flat
    // thumbnail path (…/thumb.webp). Both live on the thumb servers.
    const coverPath = typeof g.thumbnail === "string" ? g.thumbnail : g.cover?.path ?? g.thumbnail?.path;
    if (coverPath) coverUrl = `${s.thumbs[0]}/${coverPath.replace(/^\/+/, "")}`;
  }
  return {
    externalId: String(g.id),
    title: titleOf(g),
    altTitles: [g.title?.japanese, g.title?.pretty].filter(Boolean) as string[],
    coverUrl,
    category: "MANGA",
    format: tagNames(g, "category")[0] ?? "manga",
    year: g.upload_date ? new Date(g.upload_date * 1000).getUTCFullYear() : null,
    popularity: g.num_favorites ?? undefined,
    tags: tagNames(g, "tag"),
    creator: tagNames(g, "artist")[0] ?? tagNames(g, "group")[0] ?? null,
    externalUrl: `https://nhentai.net/g/${g.id}/`,
    chaptersCount: g.num_pages ?? null,
    extra: {
      source: "nhentai",
      language: tagNames(g, "language"),
      parody: tagNames(g, "parody"),
    },
  };
}

async function listUrl(url: string, withCover: boolean): Promise<LiveSearchItem[]> {
  const j = await nhJson<NhList>(url);
  return Promise.all((j.result ?? []).filter((g) => g && g.id != null).map((g) => toItem(g, withCover)));
}

async function details(externalId: string): Promise<NhGallery | null> {
  const g = await nhJson<NhGallery>(`${BASE}/galleries/${encodeURIComponent(externalId)}`);
  if (!g?.id) return null;
  return g;
}

export const nhentaiAdapter: LiveAdapter = {
  id: "nhentai",
  integration:
    "nhentai official public JSON API v2 (nhentai.net/api/v2 — keyless): paged galleries, text search, popular listing, per-gallery detail with typed tags, and real page resolution from the site's own image servers (documented /cdn endpoint). Anonymous API access, nothing bypassed.",

  async ping() {
    const j = await nhJson<NhList>(`${BASE}/galleries?page=1&per_page=1`);
    if (!j.result?.length) throw new Error("nhentai: API answered but returned no galleries");
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const query = q.trim();
    if (!query) return this.popular?.({ page }) ?? [];
    const url = `${BASE}/galleries?query=${encodeURIComponent(query)}&page=${page}&per_page=24`;
    return listUrl(url, true);
  },

  async popular(opts) {
    const page = Math.max(1, opts?.page ?? 1);
    if (page === 1) {
      // The API's popular endpoint is a single unpaged page — serve it as
      // page 1 (true current popularity), then continue with newest-first.
      try {
        const pop = await listUrl(`${BASE}/galleries/popular`, true);
        if (pop.length) return pop;
      } catch {
        /* fall through to newest-first */
      }
    }
    // /galleries is newest-first, so deep pages keep surfacing NEW uploads —
    // exactly the "if anything new is added I see it here" requirement.
    return listUrl(`${BASE}/galleries?page=${page}&per_page=24`, true);
  },

  async details(externalId) {
    const g = await details(externalId);
    if (!g) return null;
    const item = await toItem(g, true);
    item.description = g.scanlator ? `Scanlator: ${g.scanlator}` : null;
    item.genres = tagNames(g, "category").concat(tagNames(g, "language"));
    item.popularity = g.num_favorites ?? undefined;
    return item;
  },

  async units(externalId): Promise<LiveUnits> {
    const g = await details(externalId);
    if (!g?.pages?.length) throw new Error(`nhentai: gallery ${externalId} has no pages`);
    const s = await servers();
    const pages = g.pages.map((p) => `${s.images[0]}/${p.path.replace(/^\/+/, "")}`);
    return {
      chapters: [
        {
          number: 1,
          title: titleOf(g),
          pages,
          pageKind: "image",
        },
      ],
    };
  },
};
