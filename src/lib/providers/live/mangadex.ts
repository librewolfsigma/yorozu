// MangaDex — official public JSON API (https://api.mangadex.org/docs/).
//
// VERIFIED from sandbox (2025):
//  - GET /manga?title=...&contentRating[]=pornographic → real collection.
//  - GET /manga/{id}/feed?translatedLanguage[]=en → real chapter list.
//  - GET /at-home/server/{chapterId} → real baseUrl + hashed page filenames.
//
// MangaDex's official API explicitly licenses client apps to read chapters
// through the at-home server — this is an AUTHORIZED reading integration,
// not a scraper. No auth, DRM or paywall is bypassed. Covers come from
// uploads.mangadex.org; page images from *.mangadex.network at-home servers,
// both proxied through /api/img (strict allowlist extended for MangaDex).
//
// Category routing: originalLanguage ko → MANHWA, zh → MANHWA (manhua),
// everything else → MANGA.

import { LiveFetchError, boundedJson, curlJson, PLATFORM_UA } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

const API = "https://api.mangadex.org";
const UA = "YozoraPlatform/1.0 (MangaDex provider; +https://github.com/librewolfsigma/yozora)";
const CONTENT_RATING = "contentRating[]=pornographic&contentRating[]=erotica";

interface MdRelationship { id: string; type: string; attributes?: Record<string, unknown> }
interface MdTag { id: string; attributes: { name: Record<string, string> } }
interface MdManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles: Record<string, string>[];
    description: Record<string, string>;
    originalLanguage?: string | null;
    status?: string | null;
    year?: number | null;
    lastChapter?: string | null;
    contentRating?: string;
    tags?: MdTag[];
  };
  relationships?: MdRelationship[];
}
interface MdChapter {
  id: string;
  attributes: {
    volume: string | null;
    chapter: string | null;
    title: string | null;
    translatedLanguage: string;
    externalUrl: string | null;
    isUnavailable?: boolean;
    pages?: number;
    publishAt?: string;
  };
}

async function mdGet<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      if (res.status === 429 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 900));
        const retry = await fetch(`${API}${path}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
        if (retry.ok) return await boundedJson<T>(retry);
      }
      throw new LiveFetchError(res.status, `MangaDex upstream ${res.status}`);
    }
    const json = (await boundedJson<{ result: string; data: T }>(res));
    if (json.result !== "ok") throw new LiveFetchError(502, "MangaDex returned non-ok result");
    return json.data;
  } catch (e) {
    if (e instanceof LiveFetchError && e.status !== 502) throw e;
    // Node-fetch TLS/socket failures against MangaDex's CDN are transient from
    // some networks — fall back to the system curl transport (same API, same
    // anonymous read) before giving up.
    try {
      return await curlJson<{ result: string; data: T }>(`${API}${path}`, { timeoutMs: 15_000 }).then((json) => {
        if (json.result !== "ok") throw new LiveFetchError(502, "MangaDex returned non-ok result");
        return json.data;
      });
    } catch (e2) {
      if (e instanceof LiveFetchError && e.status !== 502) throw e;
      throw new LiveFetchError(502, `MangaDex request failed: ${e2 instanceof Error ? e2.message : String(e2)}`);
    }
  }
}

function pickTitle(t: Record<string, string>): string {
  return t.en ?? t["ja-ro"] ?? Object.values(t)[0] ?? "Untitled";
}

function categoryFor(lang: string | null | undefined): "MANGA" | "MANHWA" {
  if (lang === "ko" || lang === "zh" || lang === "zh-Hans") return "MANHWA";
  return "MANGA";
}

function coverUrlOf(m: MdManga): string | null {
  const cover = m.relationships?.find((r) => r.type === "cover_art");
  const fileName = (cover?.attributes as { fileName?: string } | undefined)?.fileName;
  if (!fileName) return null;
  return `https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg`;
}

function bannerUrlOf(m: MdManga): string | null {
  const cover = m.relationships?.find((r) => r.type === "cover_art");
  const fileName = (cover?.attributes as { fileName?: string } | undefined)?.fileName;
  if (!fileName) return null;
  return `https://uploads.mangadex.org/covers/${m.id}/${fileName}.512.jpg`;
}

function normalizeManga(m: MdManga): LiveSearchItem {
  const a = m.attributes;
  const author = m.relationships?.find((r) => r.type === "author");
  const authorName = (author?.attributes as { name?: string } | undefined)?.name ?? null;
  const tags = (a.tags ?? []).map((t) => t.attributes?.name?.en ?? "").filter(Boolean);
  return {
    externalId: m.id,
    title: pickTitle(a.title),
    altTitles: a.altTitles.slice(0, 6).map(pickTitle).filter(Boolean),
    description: a.description?.en ?? Object.values(a.description ?? {})[0] ?? null,
    coverUrl: coverUrlOf(m),
    bannerUrl: bannerUrlOf(m),
    category: categoryFor(a.originalLanguage),
    format: a.originalLanguage === "ko" ? "Manhwa" : a.originalLanguage === "zh" ? "Manhua" : "Manga",
    status: (a.status ?? null) === "cancelled" ? "CANCELLED" : (a.status ?? null)?.toUpperCase() ?? null,
    year: a.year ?? null,
    popularity: 0,
    tags: tags.slice(0, 30),
    creator: authorName,
    externalUrl: `https://mangadex.org/title/${m.id}`,
    chaptersCount: a.lastChapter ? Number(a.lastChapter) || null : null,
    extra: {
      source: "mangadex",
      contentRating: a.contentRating ?? null,
      readable: true, // authorized at-home reading
    },
  };
}

function normalizeChapter(c: MdChapter): { number: number; title: string | null; externalUrl: string | null; extra: Record<string, unknown> } {
  const num = Number(c.attributes.chapter) || 0;
  return {
    number: num,
    title: c.attributes.title ?? null,
    externalUrl: c.attributes.externalUrl ?? `https://mangadex.org/chapter/${c.id}`,
    extra: { chapterId: c.id, volume: c.attributes.volume, pages: c.attributes.pages ?? null, lang: c.attributes.translatedLanguage },
  };
}

const FEED_QUERY = `translatedLanguage[]=en&${CONTENT_RATING}&order[chapter]=asc&limit=500&includes[]=scanlation_group`;

export const mangadexAdapter: LiveAdapter = {
  id: "mangadex",
  integration:
    "MangaDex official public API (api.mangadex.org, documented at api.mangadex.org/docs) — anonymous reads. " +
    "Chapters are read through MangaDex's own at-home server (api.mangadex.org/at-home/server), which the API explicitly " +
    "provides for client apps: an authorized reading integration, no scraping, no DRM or paywall bypass. " +
    "Adult content selected via contentRating=erotica,pornographic.",

  async ping() {
    // Cheap public status endpoint... not guaranteed; use a 1-item manga query.
    await mdGet<MdManga[]>(`/manga?limit=1&${CONTENT_RATING}`);
  },

  async search(q, opts) {
    const page = Math.max(0, (opts?.page ?? 1) - 1) * 24;
    if (!q.trim()) {
      // Browse: most-followed adult titles.
      const data = await mdGet<MdManga[]>(
        `/manga?limit=24&offset=${page}&${CONTENT_RATING}&includes[]=cover_art&includes[]=author&order[followedCount]=desc`,
      );
      return data.map(normalizeManga);
    }
    const data = await mdGet<MdManga[]>(
      `/manga?title=${encodeURIComponent(q.trim())}&limit=24&offset=${page}&${CONTENT_RATING}&includes[]=cover_art&includes[]=author&order[relevance]=desc`,
    );
    return data.map(normalizeManga);
  },

  async popular(opts) {
    return mangadexAdapter.search("", opts);
  },

  async details(externalId) {
    const data = await mdGet<MdManga>(`/manga/${externalId}?includes[]=cover_art&includes[]=author`);
    return normalizeManga(data);
  },

  async units(externalId) {
    const chapters: MdChapter[] = [];
    let offset = 0;
    for (;;) {
      const batch = await mdGet<MdChapter[]>(`/manga/${externalId}/feed?${FEED_QUERY}&offset=${offset}`);
      chapters.push(...batch);
      if (batch.length < 500 || chapters.length >= 2000) break;
      offset += 500;
    }
    if (!chapters.length) return null;
    // Group by chapter number (multiple uploads/languages share a number);
    // keep the earliest upload (feed is ordered asc). Each chapter becomes a
    // LAZY chapter: one `mangadex-chapter:{id}` plan token stored as
    // sourceUrl, resolved to real at-home image URLs on first open (at-home
    // base URLs expire, so persisting them would break re-reads).
    const seen = new Set<string>();
    const out: LiveUnits["chapters"] = [];
    for (const c of chapters) {
      if (c.attributes.isUnavailable) continue;
      const norm = normalizeChapter(c);
      const key = norm.number > 0 ? `n${norm.number}` : `c${norm.extra.chapterId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        number: norm.number,
        title: norm.title,
        pages: [`mangadex-chapter:${norm.extra.chapterId}`],
        pageKind: "page-url",
      });
    }
    return { chapters: out };
  },

  /**
   * Lazy resolution: `mangadex-chapter:{id}` token → real image URLs from the
   * at-home server. Base URLs expire (~15 min), so they must never be
   * persisted — resolve at read time.
   */
  async resolveChapter(sourceUrl: string) {
    const token = sourceUrl.startsWith("mangadex-chapter:") ? sourceUrl.slice("mangadex-chapter:".length) : sourceUrl;
    const atHome = await fetch(`${API}/at-home/server/${token}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15_000),
    }).then((r) => {
      if (!r.ok) throw new LiveFetchError(r.status, `MangaDex at-home ${r.status}`);
      return r.json() as Promise<{ baseUrl: string; chapter: { hash: string; data: string[] } }>;
    });
    if (!atHome.baseUrl || !atHome.chapter?.data?.length) {
      throw new LiveFetchError(502, "MangaDex at-home returned no pages (chapter may be unavailable)");
    }
    const { baseUrl, chapter } = atHome;
    return chapter.data.map((f) => `${baseUrl}/data/${chapter.hash}/${f}`);
  },
};
