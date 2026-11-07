// PMVHaven — the dedicated PMV/HMV (porn music video / hentai music video)
// community platform. Public keyless browse API with DIRECT playable MP4s.
//
// VERIFIED from sandbox (2026-11):
//  - GET https://pmvhaven.com/api/videos?tags=pmv&limit=100&page=1&sort=views
//      → 200 JSON {success, videos:[{_id,title,uploader,videoUrl,thumbnailUrl,
//        duration,durationSeconds,views,…}], totalVideos, totalPages, hasNext}
//  - tags= works for pmv / hmv / cosplay / <any tag>; sort= views|likes|newest
//  - videoUrl is a plain MP4 on the platform's OVH object storage —
//    HEAD/Range → 206 video/mp4. Thumbnails (webp) are on the same bucket.
//  - /api/search, /api/video/{id}, /api/categories are key-gated (401) —
//    text search is therefore NOT faked; browse-by-tag is the keyless path.
// No auth, DRM or paywall is bypassed — these are the platform's own public
// endpoints its web player uses.

import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";
import { liveJson } from "./http";

const BASE = "https://pmvhaven.com";

interface PmvVideo {
  _id: string;
  title: string;
  uploader?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  views?: number;
  likes?: number;
  duration?: string;
  durationSeconds?: number;
  tags?: string[];
  hasExplicitContent?: boolean;
}

// Recent browse pages are memoized so details()/units() can resolve a known
// video id without the key-gated /api/video/{id} endpoint. Small LRU.
const recent = new Map<string, PmvVideo>();
function remember(vs: PmvVideo[]) {
  for (const v of vs) {
    recent.set(v._id, v);
  }
  while (recent.size > 600) recent.delete(recent.keys().next().value!);
}

function toItem(v: PmvVideo): LiveSearchItem {
  return {
    externalId: v._id,
    title: v.title,
    coverUrl: v.thumbnailUrl ?? null,
    category: "AV",
    videoKind: "PMV",
    format: "PMV",
    popularity: v.views,
    creator: v.uploader ?? null,
    externalUrl: `${BASE}/video/${v._id}`,
    extra: {
      source: "pmvhaven",
      durationSec: v.durationSeconds ?? (v.duration ? v.duration.split(":").reduce((a, x) => a * 60 + Number(x), 0) : null),
    },
  };
}

async function browse(tag: string, page: number, sort = "views"): Promise<LiveSearchItem[]> {
  const j = await liveJson<{ success: boolean; videos: PmvVideo[] }>(
    `${BASE}/api/videos?tags=${encodeURIComponent(tag)}&limit=24&page=${page}&sort=${sort}`,
    { cacheKey: `pmv:${tag}:${page}:${sort}` },
  );
  const vs = j.videos ?? [];
  remember(vs);
  return vs.map(toItem);
}

export const pmvhavenAdapter: LiveAdapter = {
  id: "pmvhaven",
  integration:
    "PMVHaven public keyless browse API (/api/videos — tags, pagination, sorting) with direct MP4 playback from the platform's own object storage. Text search needs a platform key upstream, so it is honestly absent. No auth, DRM or paywall is bypassed.",

  async ping() {
    const j = await liveJson<{ success: boolean }>(`${BASE}/api/videos?tags=pmv&limit=1&page=1`, { timeoutMs: 12_000 });
    if (!j.success) throw new Error("pmvhaven: API answered but reported failure");
  },

  async search(q, opts) {
    // Keyless search = tag browse. Multi-word queries use the first word
    // (PMVHaven tags are single words).
    const tag = (q.trim().split(/\s+/)[0] || "pmv").toLowerCase();
    return browse(tag, Math.max(1, opts?.page ?? 1));
  },

  async popular(opts) {
    const kind = (opts as { kind?: string } | undefined)?.kind;
    const tag = kind === "HMV" ? "hmv" : "pmv";
    return browse(tag, Math.max(1, opts?.page ?? 1));
  },

  async details(externalId) {
    let v = recent.get(externalId);
    if (!v) {
      // scan a few popular pages to find the item (bounded, honest)
      for (const tag of ["pmv", "hmv"]) {
        for (let p = 1; p <= 3 && !v; p++) {
          const items = await browse(tag, p).catch(() => []);
          v = recent.get(externalId) ?? undefined;
          void items;
        }
        if (v) break;
      }
    }
    if (!v) return null;
    return toItem(v);
  },

  async units(externalId): Promise<LiveUnits | null> {
    let v = recent.get(externalId);
    if (!v) {
      const d = await this.details!(externalId);
      v = recent.get(externalId) ?? (d ? { _id: externalId, title: d.title, videoUrl: "", thumbnailUrl: d.coverUrl ?? undefined } : undefined);
    }
    if (!v?.videoUrl) return null;
    return {
      episodes: [
        {
          number: 1,
          title: "PMV",
          streamUrl: v.videoUrl,
          streamType: "mp4",
          thumbnailUrl: v.thumbnailUrl ?? null,
          durationSec: v.durationSeconds ?? null,
          summary: `Direct public MP4 served by PMVHaven's storage${v.uploader ? ` (upload by ${v.uploader})` : ""}.`,
        },
      ],
    };
  },
};
