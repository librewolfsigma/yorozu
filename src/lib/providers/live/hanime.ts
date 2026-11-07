// Hanime1.me — hentai streaming site. Public HTML pages expose the site's
// own signed MP4 playback URLs; pages are fetched with the curl-resilient
// transport because the host intermittently challenges server TLS prints.
//
// VERIFIED from sandbox (2026-11):
//  - hanime1.me / search?q=<q> / watch?v=<id> reachable (curl 200; fetch is
//    Cloudflare-gated → liveTextResilient handles both transports)
//  - watch pages contain direct signed MP4s on vdownload.hembed.com
//    (480p/720p/1080p variants, e.g. /409060-720p.mp4?secure=…)
// Signed URLs expire → resolved fresh per units() call (short cache only).
// No auth, DRM or paywall is bypassed.

import { match1, matchAll, liveTextResilient, htmlDecode } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

const BASE = "https://hanime1.me";

function parseListing(html: string): LiveSearchItem[] {
  const items: LiveSearchItem[] = [];
  const seen = new Set<string>();
  // Cards: <a ... href="https://hanime1.me/watch?v=<id>" ...> with a card
  // image and overlay title nearby.
  for (const m of html.matchAll(/href="https:\/\/hanime1\.me\/watch\?v=(\d+)"/g)) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const around = html.slice(Math.max(0, m.index - 500), (m.index ?? 0) + 900);
    const title =
      match1(around, /title="([^"]{4,180})"/) ??
      match1(around, /<h\d[^>]*[^>]*>([^<]{4,180})</) ??
      match1(around, /alt="([^"]{4,180})"/);
    const thumb =
      match1(around, /src="(https:\/\/hcert\d?\.hanime1\.me[^"]+\.(?:jpg|webp|png)[^"]*)"/) ??
      match1(around, /data-src="(https:\/\/[^"]+\.(?:jpg|webp|png)[^"]*)"/);
    const durRaw = match1(around, />(\d{1,2}:\d{2}(?::\d{2})?)</);
    const durSec = durRaw ? durRaw.split(":").reduce((a, x) => a * 60 + Number(x), 0) : null;
    if (!title || title.length < 4) continue;
    items.push({
      externalId: id,
      title: htmlDecode(title).trim(),
      coverUrl: thumb ? htmlDecode(thumb) : null,
      category: "AV",
      videoKind: "HENTAI",
      format: "Hentai stream",
      externalUrl: `${BASE}/watch?v=${id}`,
      extra: { source: "hanime", durationSec: durSec },
    });
    if (items.length >= 40) break;
  }
  return items;
}

export const hanimeAdapter: LiveAdapter = {
  id: "hanime",
  integration:
    "Public website integration (hanime1.me): HTML search + watch pages parsed for the site's own signed MP4 playback URLs (resolved fresh per request). No auth, DRM or paywall is bypassed.",

  async ping() {
    const html = await liveTextResilient(`${BASE}/`, { timeoutMs: 15_000 });
    if (!html.includes("hanime")) throw new Error("hanime: unexpected page contents");
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const kw = q.trim();
    // search pages are offset-based via &page=
    const html = await liveTextResilient(`${BASE}/search?q=${encodeURIComponent(kw)}&page=${page}`, {
      referer: `${BASE}/`,
      cacheKey: `han:${kw}:${page}`,
    });
    return parseListing(html);
  },

  async popular(opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const html = await liveTextResilient(`${BASE}/search?q=&page=${page}`, {
      referer: `${BASE}/`,
      cacheKey: `han:pop:${page}`,
    });
    const items = parseListing(html);
    return items.length ? items : this.search("hentai", opts);
  },

  async details(externalId) {
    const html = await liveTextResilient(`${BASE}/watch?v=${externalId}`, { referer: `${BASE}/` });
    const title = htmlDecode(match1(html, /property="og:title" content="([^"]+)"/) ?? match1(html, /<title>([^<]+)<\/title>/) ?? externalId).trim();
    const thumb = match1(html, /property="og:image" content="([^"]+)"/);
    const tags = matchAll(html, /href="https:\/\/hanime1\.me\/search\?q=[^"]*"[^>]*>([^<]{2,40})</).slice(0, 20);
    return {
      externalId,
      title,
      coverUrl: thumb ? htmlDecode(thumb) : null,
      category: "AV",
      videoKind: "HENTAI",
      format: "Hentai stream",
      tags,
      externalUrl: `${BASE}/watch?v=${externalId}`,
      extra: { source: "hanime" },
    };
  },

  async units(externalId): Promise<LiveUnits | null> {
    const html = await liveTextResilient(`${BASE}/watch?v=${externalId}`, { referer: `${BASE}/`, cacheTtlMs: 45_000 });
    const urls = [...html.matchAll(/https:\/\/vdownload\.hembed\.com\/[^"'\s\\]+\.mp4\?[^"'\s\\]+/g)].map((m) => m[0]);
    if (!urls.length) return null;
    // Prefer 720p, then highest resolution present.
    const pick = urls.find((u) => u.includes("-720p")) ?? urls[urls.length - 1];
    const thumb = match1(html, /property="og:image" content="([^"]+)"/);
    return {
      episodes: [
        {
          number: 1,
          title: "Stream",
          streamUrl: pick,
          streamType: "mp4",
          thumbnailUrl: thumb ? htmlDecode(thumb) : null,
          summary: "Public stream served by hanime1.me (resolved live from the watch page).",
        },
      ],
    };
  },
};
