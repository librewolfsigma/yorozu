// MangaUpdates — official public API (https://api.mangaupdates.com/v1,
// interactive docs at api.mangaupdates.com/info). Anonymous reads.
//
// VERIFIED from sandbox (2025):
//  - POST /v1/series/search {search, categories} → real results (3724 hits
//    for "fate" with Hentai category).
//  - GET /v1/series/{id} → real full record (title, associated titles,
//    description, image, year, rating, genres, category, status, beam).
//
// Scope honesty: MangaUpdates is a METADATA database. It does not host
// chapters; `units()` returns null and reading stays with chapter providers
// (MangaDex / E-Hentai / Manga18fx). Search requires ≥1 character, so there
// is no honest "browse/popular" listing — capabilities reflect that.

import { LiveFetchError, boundedJson } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

const API = "https://api.mangaupdates.com/v1";
const UA = "YozoraPlatform/1.0 (MangaUpdates provider; +https://github.com/librewolfsigma/yozora)";

interface MuRecord {
  series_id: number | string;
  title: string;
  associated?: { title: string }[];
  description?: string | null;
  image?: { url?: { original?: string | null; thumb?: string | null } | null } | null;
  year?: string | null;
  rating?: string | number | null;
  genre?: string[] | null;
  category?: string[] | null;
  status?: number | string | null;
  type?: string | null;
  latest_chapter?: number | null;
  url?: string | null;
  bayesian_rating?: string | null;
}

async function muFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new LiveFetchError(res.status, `MangaUpdates upstream ${res.status}`);
    return await boundedJson<T>(res);
  } catch (e) {
    if (e instanceof LiveFetchError) throw e;
    throw new LiveFetchError(502, `MangaUpdates request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function statusLabel(s: number | string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const map: Record<number, string> = { 0: "ONGOING", 1: "COMPLETED", 2: "CANCELLED", 3: "HIATUS" };
  if (typeof s === "number") return map[s] ?? null;
  return s.toUpperCase();
}

function typeLabel(t: string | null | undefined): { format: string; category: "MANGA" | "MANHWA" } {
  const s = (t ?? "").toLowerCase();
  if (s.includes("manhwa")) return { format: "Manhwa", category: "MANHWA" };
  if (s.includes("manhua")) return { format: "Manhua", category: "MANHWA" };
  return { format: t || "Manga", category: "MANGA" };
}

function normalize(r: MuRecord): LiveSearchItem {
  const { format, category } = typeLabel(r.type);
  const rating = r.rating ? Number(r.rating) : r.bayesian_rating ? Number(r.bayesian_rating) : null;
  return {
    externalId: String(r.series_id),
    title: r.title,
    altTitles: (r.associated ?? []).map((a) => a.title).slice(0, 8),
    description: r.description ?? null,
    coverUrl: r.image?.url?.original ?? r.image?.url?.thumb ?? null,
    category,
    format,
    status: statusLabel(r.status),
    year: r.year ? Number(r.year) || null : null,
    score: rating != null && !Number.isNaN(rating) ? rating : null,
    genres: r.genre ?? [],
    tags: r.category ?? [],
    externalUrl: r.url ?? `https://www.mangaupdates.com/series.html?id=${r.series_id}`,
    chaptersCount: r.latest_chapter ?? null,
    extra: { source: "mangaupdates", metadataOnly: true },
  };
}

export const mangaupdatesAdapter: LiveAdapter = {
  id: "mangaupdates",
  integration:
    "MangaUpdates official public API (api.mangaupdates.com/v1, docs at api.mangaupdates.com/info) — anonymous reads. " +
    "Metadata database only: series info, associated titles, genres, ratings, status. It hosts no chapters — " +
    "the UI links to MangaUpdates and reading stays with chapter providers. Adult scope via documented category filters.",

  async ping() {
    // /series/1 does NOT exist upstream (verified 404) — probe with a real
    // 1-result search instead.
    await muFetch<{ results: unknown[] }>("/series/search", {
      method: "POST",
      body: JSON.stringify({ search: "fate", per_page: 1 }),
      headers: { "Content-Type": "application/json" },
    });
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    if (!q.trim()) {
      // No honest browse: the search API requires ≥1 char (verified 400).
      throw new LiveFetchError(400, "MangaUpdates search requires a query — type a title.");
    }
    const body = {
      search: q.trim(),
      // Documented category list — keep the adult scope of the platform.
      categories: ["Hentai", "Adult Mature"],
      page,
      per_page: 24,
    };
    const data = await muFetch<{ results: { record: MuRecord }[]; total_hits: number }>("/series/search", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    return data.results.map((x) => normalize(x.record));
  },

  async details(externalId) {
    const r = await muFetch<MuRecord>(`/series/${externalId}`);
    return normalize(r);
  },

  // Metadata database — no chapters are materialized from MangaUpdates.
  async units(): Promise<LiveUnits | null> {
    return null;
  },
};
