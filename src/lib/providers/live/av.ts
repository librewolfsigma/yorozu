// AV providers — real public sources, honest about scope.
//
// VERIFIED from sandbox (2026-11):
//  - rule34video.com  200 — KVS tube site; search + video pages contain direct
//    mp4 URLs in flashvars. Provides adult-animation/CG video clips.
//  - javdb.com        200 — JAV metadata database (HTML). Metadata only:
//    JavDB hosts no video; playback is an explicit external action on sites
//    listed by the user's own sources. No DRM/paywall is touched.
//
// missav.ws, javlibrary, hanime API are Cloudflare-blocked from this network
// and are intentionally NOT integrated (no fakes).

import { match1, matchAll, liveText, stripTags, htmlDecode } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

// ─── Rule34Video (KVS) ───

function r34vNormalize(slug: string, title: string, thumb: string | null, durationSec: number | null): LiveSearchItem {
  return {
    externalId: slug,
    title: stripTags(title),
    coverUrl: thumb ? htmlDecode(thumb) : null,
    category: "AV",
    format: "Clip",
    externalUrl: `https://rule34video.com/video/${slug}/`,
    extra: { source: "rule34video", durationSec },
  };
}

function parseR34vList(html: string): LiveSearchItem[] {
  const items: LiveSearchItem[] = [];
  const seen = new Set<string>();
  // KVS listing: <a class="th" href=".../video/<id>/<slug>/" title="Title"><...>
  //   <img class="thumb" src="...1.jpg"> ... <div class="duration">m:ss</div>
  for (const m of html.matchAll(
    /<a[^>]+href="https:\/\/rule34video\.com\/video\/(\d+)\/[^"]*"[^>]*title="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g,
  )) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    const title = htmlDecode(m[2]);
    const inner = m[4];
    const thumb =
      match1(inner, /<img class="thumb" src="([^"]+)"/) ??
      match1(inner, /src="(https:\/\/rule34video\.com\/contents\/[^"]+\.jpg)"/);
    const durRaw = match1(inner, /class="duration[^"]*"[^>]*>([\d:]+)</) ?? match1(inner, />(\d{1,2}:\d{2}(?::\d{2})?)</);
    const durSec = durRaw ? durRaw.split(":").reduce((acc, x) => acc * 60 + Number(x), 0) : null;
    if (!title || title.length < 4) continue;
    items.push(r34vNormalize(slug, title, thumb, durSec));
    if (items.length >= 40) break;
  }
  return items;
}

export const rule34videoAdapter: LiveAdapter = {
  id: "rule34video",
  integration:
    "Public website integration (Rule34Video, Kernel-Video-Sharing based): HTML search/listing + video pages parsed for the publicly served MP4 playback URLs the site itself exposes in its player flashvars. No auth, DRM or paywall is bypassed.",

  async ping() {
    await liveText("https://rule34video.com/", { timeoutMs: 12_000 });
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    // KVS search URLs use dash-joined slugs (spaces trigger upstream 403s)
    const kw = (q.trim() || "hentai").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "hentai";
    const html = await liveText(
      `https://rule34video.com/search/${encodeURIComponent(kw)}/${page}/`,
      { cacheKey: `r34q:${kw}:${page}` },
    );
    return parseR34vList(html);
  },

  async popular(opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const html = await liveText(`https://rule34video.com/most-popular/${page}/`, { cacheKey: `r34p:${page}` });
    const items = parseR34vList(html);
    return items.length ? items : rule34videoAdapter.search("hentai", opts);
  },

  async details(externalId) {
    const html = await liveText(`https://rule34video.com/video/${externalId}/x/`, { cacheKey: `r34v:${externalId}` });
    const title = stripTags(match1(html, /<h1[^>]*>([^<]+)<\/h1>/) ?? externalId);
    const thumb = match1(html, /property="og:image" content="([^"]+)"/) ?? match1(html, /preview_url:\s*'([^']+)'/);
    const durRaw = match1(html, /time">(\d+:\d+(?::\d+)?)</);
    const dur = durRaw ? durRaw.split(":").reduce((acc, x) => acc * 60 + Number(x), 0) : null;
    const tags = matchAll(html, /href="https:\/\/rule34video\.com\/tag\/[^"]+\/"[^>]*>([^<]+)</).map(stripTags).slice(0, 24);
    return {
      externalId,
      title,
      coverUrl: thumb ? htmlDecode(thumb) : null,
      category: "AV",
      format: "Clip",
      tags,
      externalUrl: `https://rule34video.com/video/${externalId}/`,
      extra: { source: "rule34video", durationSec: dur },
    };
  },

  async units(externalId) {
    const html = await liveText(`https://rule34video.com/video/${externalId}/x/`, { cacheKey: `r34v:${externalId}` });
    // KVS flashvars: video_url / video_alt_url with direct mp4 + access token
    const urls: { url: string; quality: string }[] = [];
    for (const m of html.matchAll(/video_url(?:_alt(\d?))?:\s*'([^']+)'/g)) {
      const q = match1(html, new RegExp(`video_url${m[1] ? "_alt" + m[1] : ""}_text:\\s*'([^']+)'`));
      urls.push({ url: m[2], quality: q ?? "auto" });
    }
    if (!urls.length) return null;
    const best = urls.find((u) => u.quality === "720p") ?? urls[0];
    const durRaw = match1(html, /time">(\d+:\d+(?::\d+)?)</);
    const dur = durRaw ? durRaw.split(":").reduce((acc, x) => acc * 60 + Number(x), 0) : null;
    const thumb = match1(html, /preview_url:\s*'([^']+)'/) ?? match1(html, /property="og:image" content="([^"]+)"/);
    return {
      episodes: [
        {
          number: 1,
          title: "Clip",
          streamUrl: best.url,
          streamType: "mp4",
          thumbnailUrl: thumb ? htmlDecode(thumb) : null,
          durationSec: dur,
          summary: `Public clip served by rule34video.com (${best.quality}).`,
        },
      ],
    };
  },
};
