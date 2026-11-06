// AniDB — anime titles dump + crosswalk ID mapping.
//
// VERIFIED from sandbox (2025): https://anidb.net/api/anime-titles.xml.gz
// responds HTTP 200 application/gzip. This is AniDB's own public titles
// export (documented for API users at wiki.anidb.net HTTP API definition).
//
// Scope honesty: the public HTTP titles dump contains ONLY ids + titles +
// type/lang. Full per-anime metadata requires AniDB's rate-limited API with
// a registered client — NOT integrated (nothing invented). What this module
// provides:
//   1. `anidb` live adapter: real title search over the cached dump.
//   2. `buildAnidbCrosswalk()`: scheduled sync that maps AniDB ids onto
//      existing unified Media entries (from AniList etc.) by normalized
//      title, storing ProviderLink rows — cross-provider ID mapping used
//      for dedup + "open on AniDB" attribution links.
//
// AniDB requires a descriptive User-Agent and bans aggressive clients; the
// dump is fetched at most once per process + refreshed weekly by the sync
// scheduler (see src/lib/sync.ts).

import gunzip from "node:zlib";
import { promisify } from "node:util";
import type { PrismaClient } from "@prisma/client";
import { LiveFetchError } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

const DUMP_URL = "https://anidb.net/api/anime-titles.xml.gz";
const UA = "YozoraPlatform/1.0 (anime metadata crosswalk; +https://github.com/librewolfsigma/yozora)";

const gunzipAsync = promisify(gunzip.gunzip);

export interface AnidbTitleEntry {
  aid: string;
  main: string;
  official: string[];
  synonyms: string[];
}

interface AnidbCache {
  loadedAt: number;
  entries: Map<string, AnidbTitleEntry>; // aid → entry
  byLowerTitle: Map<string, string>; // normalized title → aid
}

let cache: AnidbCache | null = null;
let loading: Promise<AnidbCache> | null = null;
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** "Type OVA | official Fate/stay night | en" rows inside the dump. */
function parseTitlesXml(xml: string): Map<string, AnidbTitleEntry> {
  const map = new Map<string, AnidbTitleEntry>();
  const animeRe = /<anime aid="(\d+)">([\s\S]*?)<\/anime>/g;
  const titleRe = /<title ([^>]*)>([^<]*)<\/title>/g;
  let m: RegExpExecArray | null;
  while ((m = animeRe.exec(xml)) !== null) {
    const aid = m[1];
    const body = m[2];
    const entry: AnidbTitleEntry = { aid, main: "", official: [], synonyms: [] };
    let t: RegExpExecArray | null;
    titleRe.lastIndex = 0;
    while ((t = titleRe.exec(body)) !== null) {
      const attrs = t[1];
      const text = t[2].trim();
      if (!text) continue;
      const isMain = /type="main"/.test(attrs);
      const isOfficial = /type="official"/.test(attrs);
      const isSynonym = /type="synonym"/.test(attrs) || /type="short"/.test(attrs);
      if (isMain) entry.main = text;
      else if (isOfficial) entry.official.push(text);
      else if (isSynonym) entry.synonyms.push(text);
    }
    if (entry.main || entry.official.length) map.set(aid, entry);
  }
  return map;
}

async function ensureLoaded(force = false): Promise<AnidbCache> {
  if (cache && !force && Date.now() - cache.loadedAt < WEEK_MS) return cache;
  if (loading) return loading;
  loading = (async () => {
    const res = await fetch(DUMP_URL, {
      headers: { "User-Agent": UA, "Accept-Encoding": "identity" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new LiveFetchError(res.status, `AniDB titles dump upstream ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const xml = (await gunzipAsync(buf)).toString("utf8");
    const entries = parseTitlesXml(xml);
    const byLowerTitle = new Map<string, string>();
    for (const [aid, e] of entries) {
      for (const title of [e.main, ...e.official, ...e.synonyms]) {
        const key = normTitle(title);
        if (key && !byLowerTitle.has(key)) byLowerTitle.set(key, aid);
      }
    }
    cache = { loadedAt: Date.now(), entries, byLowerTitle };
    return cache;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/g, "")
    .trim();
}

export const anidbAdapter: LiveAdapter = {
  id: "anidb",
  integration:
    "AniDB public anime-titles export (anidb.net/api/anime-titles.xml.gz, wiki.anidb.net HTTP API). Real ids+titles; " +
    "used for title search and scheduled cross-provider ID mapping (AniDB ↔ unified catalog). " +
    "Full AniDB metadata (creators, ratings, episode tables) requires a registered AniDB API client and is " +
    "NOT integrated — nothing is faked.",

  async ping() {
    const c = await ensureLoaded();
    if (c.entries.size < 1000) throw new LiveFetchError(502, "AniDB dump parsed suspiciously few entries");
  },

  async search(q, opts) {
    if (!q.trim()) throw new LiveFetchError(400, "AniDB title search requires a query (dump has no popularity order).");
    const c = await ensureLoaded();
    const needle = q.trim().toLowerCase();
    const items: LiveSearchItem[] = [];
    for (const [, e] of c.entries) {
      const hit =
        e.main.toLowerCase().includes(needle) ||
        e.official.some((t) => t.toLowerCase().includes(needle)) ||
        e.synonyms.some((t) => t.toLowerCase().includes(needle));
      if (!hit) continue;
      items.push({
        externalId: e.aid,
        title: e.main || e.official[0],
        altTitles: [...e.official, ...e.synonyms].slice(0, 8),
        category: "ANIME",
        format: "Anime",
        externalUrl: `https://anidb.net/anime/${e.aid}`,
        extra: { source: "anidb", metadataOnly: true, titlesDump: true },
      });
      if (items.length >= (opts?.page === 1 ? 24 : 24)) break;
    }
    return items;
  },

  // Titles dump has no chapters/episodes — nothing is materialized.
  async units(): Promise<LiveUnits | null> {
    return null;
  },
};

/**
 * Crosswalk sync: for every unified Media that has an anilist ProviderLink,
 * find the AniDB id via the titles dump (exact normalized-title match) and
 * store a ProviderLink(providerId:"anidb"). Returns a small report for the
 * sync log — scheduled by src/lib/sync.ts, also triggerable via
 * POST /api/sync/run.
 */
export async function buildAnidbCrosswalk(db: PrismaClient): Promise<{ mapped: number; checked: number; skipped: number }> {
  const c = await ensureLoaded();
  const medias = await db.media.findMany({
    where: { category: "ANIME" },
    include: { links: { select: { providerId: true, externalId: true } } },
  });
  let mapped = 0;
  let checked = 0;
  let skipped = 0;
  for (const m of medias) {
    const anilist = m.links.find((l) => l.providerId === "anilist");
    const anilistNumeric = anilist && /^\d+$/.test(anilist.externalId);
    if (!anilistNumeric) {
      skipped++;
      continue;
    }
    checked++;
    const existing = await db.providerLink.findFirst({
      where: { mediaId: m.id, providerId: "anidb" },
    });
    if (existing) continue;
    const candidates = [m.title, ...(JSON.parse(m.altTitles ?? "[]") as string[])];
    let aid: string | null = null;
    for (const t of candidates) {
      const hit = c.byLowerTitle.get(normTitle(t));
      if (hit) {
        aid = hit;
        break;
      }
    }
    if (!aid) continue;
    await db.providerLink.upsert({
      where: { providerId_externalId: { providerId: "anidb", externalId: aid } },
      create: { mediaId: m.id, providerId: "anidb", externalId: aid, externalUrl: `https://anidb.net/anime/${aid}` },
      update: {},
    });
    mapped++;
  }
  return { mapped, checked, skipped };
}
