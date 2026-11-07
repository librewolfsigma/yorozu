// EPorner — official PUBLIC JSON API (eporner.com/api/v2, documented) plus
// the site's own stream-authorization endpoint that its web player calls.
//
// VERIFIED from sandbox (2026-11):
//  - GET /api/v2/video/search/?query=pmv&per_page=5&order=top-weekly&gay=0&sm=0&format=json
//      → 200 JSON {total_count, videos:[{id,title,url,embed,length_sec,…}]}
//  - video page embeds a 32-hex `hash` variable; computing base36 of its four
//    8-hex chunks and calling /xhr/video/<id>?hash=<calc> returns
//    {sources:{mp4:{"2160p(4K) HD":{src,type,default},…}}} — direct MP4s on
//    the site's public CDN. This is the same request the site's player makes.
//  - Freshly-uploaded videos may lack the hash for a short processing window
//    → units() reports honestly instead of faking a stream.
// No key, no account, no DRM bypass — public API + public player variables.

import { boundedJson, match1, liveJson, liveText } from "./http";
import { liveFetchErrorStatus } from "@/lib/imgproxy";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

const BASE = "https://www.eporner.com";

interface EprVideo {
  id: string;
  title: string;
  url: string;
  embed: string;
  views: number;
  rate: string;
  length_sec: number;
  length_min: string;
  added: string;
  keywords?: string;
  default_thumb?: { src?: string };
  thumbs?: { src?: string }[];
}

function thumbOf(v: EprVideo): string | null {
  return v.default_thumb?.src ?? v.thumbs?.[0]?.src ?? null;
}

function toItem(v: EprVideo): LiveSearchItem {
  return {
    externalId: v.id,
    title: v.title,
    coverUrl: thumbOf(v),
    category: "AV",
    videoKind: "PMV",
    format: "Tube video",
    popularity: v.views,
    year: v.added ? Number(v.added.slice(0, 4)) : null,
    externalUrl: v.url,
    extra: { source: "eporner", durationSec: v.length_sec },
  };
}

/** Compute the player-side hash the site's own XHR expects (yt-dlp method). */
function calcHash(hex32: string): string {
  const parts = hex32.match(/(.{8})(.{8})(.{8})(.{8})/);
  if (!parts) throw new Error("eporner: unexpected hash format");
  return [parts[1], parts[2], parts[3], parts[4]].map((p) => parseInt(p, 16).toString(36)).join("");
}

export const epornerAdapter: LiveAdapter = {
  id: "eporner",
  integration:
    "Official public JSON API (eporner.com/api/v2 — no key) for search and details, plus the site's public player XHR for direct MP4 playback URLs. No auth, DRM or paywall is bypassed.",

  async ping() {
    const j = await liveJson<{ videos: EprVideo[] }>(
      `${BASE}/api/v2/video/search/?query=test&per_page=1&format=json`,
      { timeoutMs: 12_000 },
    );
    if (!j.videos?.length) throw new Error("eporner: search API returned no data");
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const kw = q.trim() || "pmv";
    const j = await liveJson<{ total_count: number; videos: EprVideo[] }>(
      `${BASE}/api/v2/video/search/?query=${encodeURIComponent(kw)}&per_page=24&page=${page}&order=latest&gay=0&sm=0&format=json`,
      { cacheKey: `epr:${kw}:${page}` },
    );
    return (j.videos ?? []).map(toItem);
  },

  async popular(opts) {
    const page = Math.max(1, opts?.page ?? 1);
    // This provider's discover rail is PMV-tuned (top weekly PMV uploads).
    const j = await liveJson<{ videos: EprVideo[] }>(
      `${BASE}/api/v2/video/search/?query=pmv&per_page=24&page=${page}&order=top-weekly&gay=0&sm=0&format=json`,
      { cacheKey: `epr:pmv:${page}` },
    );
    return (j.videos ?? []).map(toItem);
  },

  async details(externalId) {
    const j = await liveJson<EprVideo[] | { videos?: EprVideo[] }>(
      `${BASE}/api/v2/video/id/?id=${encodeURIComponent(externalId)}&format=json`,
      { cacheKey: `eprid:${externalId}` },
    );
    const v = Array.isArray(j) ? j[0] : j.videos?.[0];
    if (!v) return null;
    return {
      ...toItem(v),
      tags: v.keywords ? v.keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 20) : undefined,
    };
  },

  async units(externalId): Promise<LiveUnits | null> {
    // Resolve through the video page → hash → player XHR (fresh per call:
    // resolved URLs embed a short-lived token).
    const details = await this.details!(externalId).catch(() => null);
    const pageUrl = details?.externalUrl ?? `${BASE}/video-${externalId}/`;
    const html = await liveText(pageUrl, { cacheTtlMs: 30_000 });
    const hash = match1(html, /hash\s*[:=]\s*["']([0-9a-f]{32})["']/);
    if (!hash) throw new Error("eporner: stream hash not published yet for this video (processing window) — try again shortly");
    const calc = calcHash(hash);
    const xhr = await fetch(`${BASE}/xhr/video/${externalId}?hash=${calc}&device=generic&domain=www.eporner.com`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", Accept: "application/json" },
    }).catch((e) => { throw Object.assign(new Error(`eporner player XHR failed: ${e.message}`), { status: liveFetchErrorStatus(e) }); });
    if (!xhr.ok) throw new Error(`eporner player XHR ${xhr.status}`);
    const data = await boundedJson<{ sources?: { mp4?: Record<string, { src: string; type: string; default?: boolean }>; hls?: Record<string, { src: string }> } }>(xhr, 2 * 1024 * 1024);
    const mp4s = Object.values(data.sources?.mp4 ?? {});
    const best = mp4s.find((s) => s.default) ?? mp4s[0] ?? null;
    const hlsEntry = Object.values(data.sources?.hls ?? {})[0] ?? null;
    const stream = best?.src ?? hlsEntry?.src ?? null;
    if (!stream) throw new Error("eporner: no playable source in player response");
    if (stream.includes("/404.mp4")) throw new Error("eporner: upstream returned its 404 placeholder — the video is too new or was removed");
    if (stream.includes("/na.mp4")) {
      // The XHR intermittently answers with its static n/a placeholder when
      // it is rate-limiting or the video was just removed. Never hand that
      // dead URL to the player — surface a retryable error instead.
      throw new Error("eporner: upstream served its n/a placeholder — the video may be unavailable right now, try again shortly");
    }
    return {
      episodes: [
        {
          number: 1,
          title: "Video",
          streamUrl: stream,
          streamType: stream.includes(".m3u8") ? "hls" : "mp4",
          thumbnailUrl: details?.coverUrl ?? null,
          durationSec: details?.extra?.durationSec as number | undefined ?? null,
          summary: "Public stream served by eporner.com (resolved via the site's own player endpoint).",
        },
      ],
    };
  },
};
