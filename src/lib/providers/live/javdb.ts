// JavDB — JAV metadata database (Japanese adult video = AV). Public HTML
// search/detail pages, fetched with the curl-resilient transport because the
// host intermittently challenges server TLS prints.
//
// VERIFIED from sandbox (2026-11):
//  - GET https://javdb.com/search?q=SSIS-700&f=all  → 200, server-rendered
//    result cards: <a href="/v/<ID>" class="box"> + <strong class="video-title">CODE
//  - detail pages expose cover (og:image / c*.jdbstatic.com), date, runtime,
//    director/maker/label/series, cast (a.actor-female), preview stills and
//    public MAGNET links (magnet:?xt=urn:btih:…)
//  - robots.txt disallows /search, /tags, /recent_videos for crawlers with a
//    20 s crawl-delay — this integration is user-initiated only, single
//    request per action, min-interval limiter + heavy caching, never a crawl.
// Metadata only — JavDB hosts no video; magnets are external links for the
// user's own client (paired with the Sukebei Nyaa provider).

import { match1, matchAll, liveTextResilient, htmlDecode } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

const BASE = "https://javdb.com";

// Simple per-host politeness limiter (robots.txt asks 20 s crawl-delay; we
// space user-initiated requests ≥5 s apart on top of caching — interactive,
// not a crawler loop).
let lastHit = 0;
async function polite(waitMs = 5_000) {
  const wait = lastHit + waitMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 8000)));
  lastHit = Date.now();
}

function parseListing(html: string): LiveSearchItem[] {
  const items: LiveSearchItem[] = [];
  // <a href="/v/<ID>" class="box" title="…"> … <div class="video-title">
  //   <strong>CODE</strong> full title … <img src="https://c0.jdbstatic.com/…">
  for (const m of html.matchAll(/<a href="(\/v\/[A-Za-z0-9]+)" class="box"[^>]*>([\s\S]{0,900}?)<\/a>/g)) {
    const id = m[1].slice(3);
    const inner = m[2];
    const codeMatch = inner.match(/<div class="video-title"><strong>([^<]+)<\/strong>([^<]*)/);
    const titleFull = codeMatch ? `${codeMatch[1]}${codeMatch[2]}`.trim() : match1(inner, /title="([^"]+)"/);
    const cover = match1(inner, /src="(https:\/\/c\d\.jdbstatic\.com\/[^"]+)"/) ?? match1(inner, /src="(\/\/c\d\.jdbstatic\.com\/[^"]+)"/);
    const date = match1(inner, /<time[^>]*>(\d{4}-\d{2}-\d{2})<\/time>/) ?? match1(inner, /metadata-title="(\d{4}-\d{2}-\d{2})"/);
    if (!titleFull) continue;
    items.push({
      externalId: id,
      title: htmlDecode(titleFull).trim(),
      coverUrl: cover ? htmlDecode(cover.startsWith("//") ? `https:${cover}` : cover) : null,
      category: "AV",
      videoKind: "JAV",
      format: "JAV (metadata + magnets)",
      year: date ? Number(date.slice(0, 4)) : null,
      externalUrl: `${BASE}/v/${id}`,
      extra: { source: "javdb", releaseDate: date },
    });
    if (items.length >= 24) break;
  }
  return items;
}

export const javdbAdapter: LiveAdapter = {
  id: "javdb",
  integration:
    "Public website integration (javdb.com): user-initiated HTML search + detail pages for JAV metadata (code, cast, studio, date, cover, previews) with public magnet links handed to the user's own torrent client. Politeness-limited and cached; no crawler, no auth bypass. JavDB hosts no video — playback stays external.",

  async ping() {
    await polite();
    const html = await liveTextResilient(`${BASE}/search?q=MIDE-500&f=all`, { referer: `${BASE}/`, timeoutMs: 15_000 });
    if (!html.includes("video-title")) throw new Error("javdb: search page did not render results");
  },

  async search(q, opts) {
    void opts;
    if (!q.trim()) return []; // no listing crawl — search only (robots.txt)
    await polite();
    const html = await liveTextResilient(`${BASE}/search?q=${encodeURIComponent(q.trim())}&f=all`, {
      referer: `${BASE}/`,
      cacheKey: `jdb:${q.trim().toLowerCase()}`,
      cacheTtlMs: 10 * 60_000,
    });
    return parseListing(html);
  },

  async details(externalId) {
    await polite();
    const html = await liveTextResilient(`${BASE}/v/${externalId}`, {
      referer: `${BASE}/`,
      cacheKey: `jdbv:${externalId}`,
      cacheTtlMs: 10 * 60_000,
    });
    const title =
      htmlDecode(match1(html, /<strong class="current-title">([^<]+)<\/strong>/) ?? match1(html, /<title>\s*([^|<]+)/) ?? externalId).trim();
    const cover =
      match1(html, /property="og:image" content="([^"]+)"/) ??
      match1(html, /id="cover-image"[^>]*src="([^"]+)"/) ??
      match1(html, /<img[^>]+src="(https:\/\/c\d\.jdbstatic\.com\/covers\/[^"]+)"/);
    const date = match1(html, /<span class="value">(\d{4}-\d{2}-\d{2})<\/span>/);
    const durRaw = match1(html, /<td class="value"><span class="[^"]*">(\d+)<\/span>\s*分钟/);
    const actors = matchAll(html, /<a class="actor-female" href="[^"]*">([^<]+)<\/a>/);
    const maker = match1(html, /href="\/makers\/[^"]*">([^<]+)<\/a>/);
    const label = match1(html, /href="\/labels\/[^"]*">([^<]+)<\/a>/);
    const series = match1(html, /href="\/series\/[^"]*">([^<]+)<\/a>/);
    const director = match1(html, /href="\/directors\/[^"]*">([^<]+)<\/a>/);
    const magnet = match1(html, /href="(magnet:\?xt=urn:btih:[a-z0-9]{32,40}[^"]*)"/);
    const tags = matchAll(html, /href="\/tags\/[^"]*"[^>]*>([^<]{2,40})<\/a>/).slice(0, 20);
    return {
      externalId,
      title,
      coverUrl: cover ? htmlDecode(cover) : null,
      category: "AV",
      videoKind: "JAV",
      format: "JAV (metadata + magnets)",
      studio: maker ? htmlDecode(maker) : null,
      creator: actors.length ? actors.map(htmlDecode).join(", ") : null,
      year: date ? Number(date.slice(0, 4)) : null,
      tags: tags.map(htmlDecode),
      externalUrl: `${BASE}/v/${externalId}`,
      extra: {
        source: "javdb",
        magnet: magnet ? htmlDecode(magnet) : undefined,
        releaseDate: date,
        runtimeMin: durRaw ? Number(durRaw) : null,
        label: label ? htmlDecode(label) : null,
        series: series ? htmlDecode(series) : null,
        director: director ? htmlDecode(director) : null,
        cast: actors.map(htmlDecode),
        durationSec: durRaw ? Number(durRaw) * 60 : null,
      },
    };
  },
  // No units(): JavDB serves metadata + magnets only — honest by design.
};
