// XVideos — general adult tube with a large JAV and PMV catalog.
//
// VERIFIED from sandbox (2026-11):
//  - search pages (xvideos.com/?k=<q>&p=<n>)      200 — server-rendered HTML
//  - video pages expose direct MP4 (setVideoUrlHigh/Low/Alternate) + HLS
//    (setVideoHLS) URLs in the site's own html5player bootstrap
//  - CDN hosts rotate per request (mp4-gcore/hls-gcore/thumb-cdn77.…) —
//    stream URLs are signed and time-limited → resolved fresh per units()
//    call, never cached long.
// No auth, DRM or paywall is bypassed: these are the same public player
// variables the site's own web player reads.

import { match1, liveTextResilient, htmlDecode } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

const BASE = "https://www.xvideos.com";

/** Video page tokens look like `video.<id>` or `video<id>` — both are public page slugs. */
const VIDEO_REF_RE = /\/video[.\-][a-z0-9_]+\//i;

function parseListing(html: string): LiveSearchItem[] {
  const items: LiveSearchItem[] = [];
  const seen = new Set<string>();
  // Listing blocks: <div class="thumb"><a href="/video.<token>/<slug>" …>
  //   <img src="https://img-…xvideos-cdn.com/…"> … <span class="duration">m:ss</span>
  //   … <a href=… title="Full Title"> (title lives on the block's second anchor)
  for (const m of html.matchAll(/<a[^>]+href="(\/video[.\-][a-z0-9_]+\/?[^"]*)"[^>]*>/gi)) {
    const href = m[1].replace(/^\//, "").replace(/\/$/, "");
    // externalId = full public path "video.<token>/<slug>" — bare tokens 404.
    const ref = href.match(/^(video[.\-][a-z0-9_]+)/i)?.[1];
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    // Look ahead in this block for the titled anchor, thumb and duration.
    const around = html.slice(m.index ?? 0, (m.index ?? 0) + 1400);
    const title =
      match1(around, new RegExp(m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\"[^>]*title=\"([^\"]{4,180})\"")) ??
      match1(around, /title="([^"]{4,180})"/);
    const thumb =
      match1(around, /data-src="(https:\/\/img[^"]+\.xvideos-cdn\.com[^"]+)"/) ??
      match1(around, /src="(https:\/\/img[^"]+\.xvideos-cdn\.com[^"]+)"/);
    const durRaw = match1(around, /class="duration">(\d+:\d+(?::\d+)?)</);
    const durSec = durRaw ? durRaw.split(":").reduce((a, x) => a * 60 + Number(x), 0) : null;
    if (!title || title.length < 4) continue;
    items.push({
      externalId: href,
      title: htmlDecode(title).trim(),
      coverUrl: thumb ? htmlDecode(thumb) : null,
      category: "AV",
      videoKind: "JAV",
      format: "Tube video",
      externalUrl: `${BASE}/${ref}/`,
      extra: { source: "xvideos", durationSec: durSec },
    });
    if (items.length >= 40) break;
  }
  return items;
}

async function searchXV(q: string, page: number): Promise<LiveSearchItem[]> {
  const kw = q.trim() || "jav";
  const url = page > 1 ? `${BASE}/?k=${encodeURIComponent(kw)}&p=${page}` : `${BASE}/?k=${encodeURIComponent(kw)}`;
  const html = await liveTextResilient(url, { referer: `${BASE}/`, cacheTtlMs: 5 * 60_000 });
  return parseListing(html);
}

export const xvideosAdapter: LiveAdapter = {
  id: "xvideos",
  integration:
    "Public website integration (xvideos.com): HTML search + the site's own html5player variables (setVideoUrlHigh/setVideoHLS) for direct public playback URLs. Signed CDN links are resolved fresh per request. No auth, DRM or paywall is bypassed.",

  async ping() {
    const html = await liveTextResilient(`${BASE}/?k=jav`, { timeoutMs: 12_000 });
    if (!VIDEO_REF_RE.test(html)) throw new Error("xvideos: listing did not render any video links");
  },

  async search(q, opts) {
    return searchXV(q, Math.max(1, opts?.page ?? 1));
  },

  async popular(opts) {
    // The declared subcategory for this provider's rail is JAV.
    return searchXV("jav", Math.max(1, opts?.page ?? 1));
  },

  async details(externalId) {
    const html = await liveTextResilient(`${BASE}/${externalId}/`, { referer: `${BASE}/` });
    const title =
      htmlDecode(match1(html, /html5player\.setVideoTitle\('([^']*)'\)/) ?? match1(html, /<title>([^<]+)<\/title>/) ?? externalId)
        .replace(/\s*-\s*XVIDEOS\.COM\s*$/i, "")
        .trim();
    const thumb = match1(html, /html5player\.setThumbUrl169\('([^']+)'\)/) ?? match1(html, /setThumbUrl\('([^']+)'\)/);
    const durRaw = match1(html, /class="(?:inactive|duration)"><span>(\d+:\d+(?::\d+)?)</) ?? match1(html, /"duration_m":\s*(\d+)/);
    return {
      externalId,
      title,
      coverUrl: thumb ? htmlDecode(thumb) : null,
      category: "AV",
      videoKind: "JAV",
      format: "Tube video",
      tags: match1(html, /data-metadata="([^"]*)"/)
        ? (JSON.parse(htmlDecode(match1(html, /data-metadata="([^"]*)"/)!)) as { tags?: { name: string }[] })?.tags?.map((t) => t.name).slice(0, 16)
        : undefined,
      externalUrl: `${BASE}/${externalId}/`,
      extra: { source: "xvideos" },
    };
  },

  async units(externalId): Promise<LiveUnits | null> {
    const html = await liveTextResilient(`${BASE}/${externalId}/`, { referer: `${BASE}/`, cacheTtlMs: 45_000 });
    const high = match1(html, /html5player\.setVideoUrlHigh\('([^']+)'\)/);
    const alt = match1(html, /html5player\.setVideoUrlAlternate\('([^']+)'\)/);
    const low = match1(html, /html5player\.setVideoUrlLow\('([^']+)'\)/);
    const hls = match1(html, /html5player\.setVideoHLS\('([^']+)'\)/);
    const best = high ?? alt ?? low ?? hls;
    if (!best) return null;
    const isHls = best.includes(".m3u8");
    const thumb = match1(html, /html5player\.setThumbUrl169\('([^']+)'\)/) ?? match1(html, /setThumbUrl\('([^']+)'\)/);
    return {
      episodes: [
        {
          number: 1,
          title: "Video",
          streamUrl: best,
          streamType: isHls ? "hls" : "mp4",
          thumbnailUrl: thumb ? htmlDecode(thumb) : null,
          summary: "Public stream served by xvideos.com (resolved live from the site's own player).",
        },
      ],
    };
  },
};
