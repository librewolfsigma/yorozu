// HentaiOcean — user-mandated ANIME streaming source (hentaiocean.com).
//
// VERIFIED from sandbox (2026-11, keyless):
//  - Browse: https://hentaiocean.com/rss.xml → 765 <item>s, each with
//    guid=slug, title, link=/watch/{slug}, pubDate, embedUrl and
//    <media:thumbnail url="https://hentaiocean.com/assets/cover/{hash}.jpg"/>.
//  - Search: site search https://hentaiocean.com/?s={q} → /watch/{slug} links.
//  - Details: documented API https://hentaiocean.com/api?action=hentai&slug={slug}
//    → {info:[{urlname, videoname, description, releasedate, coverimg,…}],
//       genres:[{genre}]}. Cover = /assets/cover/{coverimg}.
//  - STREAMS: /embed/{slug} embeds `var jsondata = {…mirrors:[{mirrorurl}]…}`.
//    A mirror like https://w1.hentaiocean.com/play?vid={filename}.mp4 is the
//    site's own player page whose JS resolves src = {mirror-origin}/video/{vid}
//    → verified 206 video/mp4 on Range. We resolve that URL server-side and
//    hand the player the direct stream. Third-party mirror hosts are ignored.
//
// User directive: anime needs STREAMING sources — HentaiOcean is the primary.

import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";
import { liveTextResilient, match1, matchAll, stripHtmlToText, htmlDecode } from "./http";

const BASE = "https://hentaiocean.com";

interface RssItem {
  slug: string;
  title: string;
  pubDate: string | null;
  thumb: string | null;
}

// The RSS is one big document (765 items) — fetched once per 3 min (http.ts
// cache) and sliced into pages locally. Real upstream data, honest pagination.
let rssCache: { at: number; items: RssItem[] } | null = null;
async function rssItems(): Promise<RssItem[]> {
  if (rssCache && Date.now() - rssCache.at < 5 * 60 * 1000) return rssCache.items;
  const xml = await liveTextResilient(`${BASE}/rss.xml`, { timeoutMs: 25_000, referer: BASE });
  const items: RssItem[] = [];
  for (const block of xml.split("<item>").slice(1)) {
    const slug =
      match1(block, /<guid>([^<]+)<\/guid>/) ??
      match1(block, /<link>[^<]*\/watch\/([^<"]+)<\/link>/);
    if (!slug) continue;
    items.push({
      slug: slug.trim(),
      title: htmlDecode(match1(block, /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) ?? slug),
      pubDate: match1(block, /<pubDate>([^<]+)<\/pubDate>/) ?? null,
      thumb: match1(block, /<media:thumbnail url="([^"]+)"/) ?? null,
    });
  }
  if (!items.length) throw new Error("hentaiocean: RSS parsed empty");
  rssCache = { at: Date.now(), items };
  return items;
}

/** Parse the site's own search HTML for /watch/{slug} links (+ titles). */
async function siteSearch(query: string): Promise<RssItem[]> {
  const html = await liveTextResilient(`${BASE}/?s=${encodeURIComponent(query)}`, {
    timeoutMs: 20_000,
    referer: BASE,
  });
  const out: RssItem[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/href="https:\/\/hentaiocean\.com\/watch\/([^"'#?]+)"/g)) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    // Best-effort title: nearest <title> or the slug words.
    out.push({ slug, title: htmlDecode(slug).replace(/[-_]/g, " "), pubDate: null, thumb: null });
  }
  return out;
}

async function detailsJson(slug: string): Promise<{
  videoname: string;
  description?: string | null;
  releasedate?: string | null;
  coverimg?: string | null;
  series?: string | null;
  genres: string[];
} | null> {
  try {
    const j = await liveTextResilient(`${BASE}/api?action=hentai&slug=${encodeURIComponent(slug)}`, {
      timeoutMs: 18_000,
      referer: BASE,
    });
    const data = JSON.parse(j) as {
      info?: { urlname: string; videoname: string; description?: string; releasedate?: string; coverimg?: string; series?: string | null }[];
      genres?: { genre: string }[];
    };
    const info = data.info?.[0];
    if (!info) return null;
    return {
      videoname: info.videoname,
      description: info.description ?? null,
      releasedate: info.releasedate ?? null,
      coverimg: info.coverimg ?? null,
      series: info.series ?? null,
      genres: (data.genres ?? []).map((g) => g.genre).filter(Boolean),
    };
  } catch {
    return null; // details are enrichment — the RSS gives us enough to browse
  }
}

/**
 * Resolve the site's own direct MP4 from an embed page:
 * 1. /embed/{slug} inlines `var jsondata = {...}` with mirrors[]
 * 2. first mirror matching *.hentaiocean.com/play?vid={file} is the site's
 *    own player; its JS plays {mirror-origin}/video/{vid}
 */
async function resolveStream(slug: string): Promise<string> {
  const html = await liveTextResilient(`${BASE}/embed/${encodeURIComponent(slug)}`, {
    timeoutMs: 20_000,
    referer: BASE,
  });
  const mirrors = matchAll(html, /"mirrorurl":"([^"]+)"/).map((m) => m.replace(/\\\//g, "/"));
  for (const mirror of mirrors) {
    const m = mirror.match(/^(https:\/\/[a-z0-9.]*hentaiocean\.com)\/play\?vid=(.+)$/i);
    if (!m) continue; // third-party mirrors (listeamed etc.) are ignored
    const origin = m[1];
    const vid = m[2];
    // The site's own player does BASE_VIDEO_URL + encodeURIComponent(vid) —
    // mirror it exactly (vid carries spaces/brackets).
    return `${origin}/video/${encodeURIComponent(vid.replace(/&amp;/g, "&"))}`;
  }
  throw new Error(`hentaiocean: no direct hentaiocean.com play mirror resolved for ${slug}`);
}

function toSearchItem(it: RssItem, enrich?: { description?: string | null; year?: number | null; genres?: string[] }): LiveSearchItem {
  return {
    externalId: it.slug,
    title: it.title,
    description: enrich?.description ?? null,
    coverUrl: it.thumb,
    category: "ANIME",
    format: "Hentai anime",
    year: enrich?.year ?? (it.pubDate ? new Date(it.pubDate).getUTCFullYear() : null),
    popularity: it.pubDate ? new Date(it.pubDate).getTime() : undefined,
    genres: enrich?.genres ?? [],
    externalUrl: `${BASE}/watch/${it.slug}`,
    episodesCount: 1,
    extra: { source: "hentaiocean" },
  };
}

export const hentaioceanAdapter: LiveAdapter = {
  id: "hentaiocean",
  integration:
    "HentaiOcean public API — documented fetch-by-slug endpoint, site RSS for browse and site search, and the site's own embed player resolved to its direct hentaiocean.com MP4 mirror. No auth, DRM or paywall bypassed; mirrors on third-party hosts are not used.",

  async ping() {
    await rssItems();
  },

  async search(q, opts) {
    const query = q.trim();
    if (!query) return this.popular?.(opts) ?? [];
    const found = await siteSearch(query);
    return found.map((it) => toSearchItem(it));
  },

  async popular(opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const all = await rssItems();
    const slice = all.slice((page - 1) * 24, page * 24);
    return slice.map((it) => toSearchItem(it));
  },

  async details(externalId) {
    const d = await detailsJson(externalId);
    if (!d) {
      // Honest fallback: RSS item identity only.
      const rss = (await rssItems()).find((i) => i.slug === externalId);
      if (!rss) return null;
      return toSearchItem(rss);
    }
    const cover = d.coverimg ? `${BASE}/assets/cover/${d.coverimg}` : null;
    return {
      externalId,
      title: d.videoname,
      description: d.description ? stripHtmlToText(d.description, 1200) : null,
      coverUrl: cover,
      bannerUrl: cover,
      category: "ANIME",
      format: "Hentai anime",
      year: d.releasedate ? new Date(d.releasedate).getUTCFullYear() : null,
      genres: d.genres,
      studio: d.series ?? null,
      externalUrl: `${BASE}/watch/${externalId}`,
      episodesCount: 1,
      extra: { source: "hentaiocean" },
    } satisfies LiveSearchItem;
  },

  async units(externalId): Promise<LiveUnits> {
    const streamUrl = await resolveStream(externalId);
    const rss = (await rssItems()).find((i) => i.slug === externalId);
    const d = await detailsJson(externalId);
    const cover = d?.coverimg ? `${BASE}/assets/cover/${d.coverimg}` : rss?.thumb ?? null;
    return {
      episodes: [
        {
          number: 1,
          title: d?.videoname ?? rss?.title ?? externalId,
          streamUrl,
          streamType: "video/mp4",
          thumbnailUrl: cover,
        },
      ],
    };
  },
};
