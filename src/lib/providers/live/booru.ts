// Booru-family image boards — real public/documented APIs, read-only.
//
// VERIFIED from sandbox (2026-11):
//  - e621      REST JSON   https://e621.net/posts.json            200 (descriptive UA required)
//  - yande.re  Moebooru    https://yande.re/post.json             200
//  - hypnohub  Gelbooru-dapi https://hypnohub.net/index.php?...json=1 200
//  - gelbooru  Gelbooru-dapi — requires a free account API key (config), returns 401 otherwise
//
// Policy: metadata + image URLs are returned as the providers publish them.
// Posts referencing minors or non-consensual themes are filtered client-side
// via tag blocklist (see BLOCKED_TAGS) as an additional safety layer on top
// of each site's own moderation. loli/shota/child tags are hard-blocked.

import { LiveFetchError, liveJson, liveText, curlJson, PLATFORM_UA } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits, SearchOpts } from "./types";

// Hard safety filter — these tags NEVER surface in Yozora, regardless of source.
const BLOCKED_TAGS = [
  "loli", "lolicon", "shota", "shotacon", "child", "toddlercon", "infant",
  "young", "preteen", " elementary", "aged_down", "child_on_child", "rape", "forced",
];

export function hasBlockedTag(tags: string[]): boolean {
  const lower = tags.map((t) => t.toLowerCase());
  return BLOCKED_TAGS.some((b) => lower.some((t) => t === b.trim() || t.startsWith(b.trim())));
}

function parseTagString(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

// ─── e621 (REST JSON) ───
// https://e621.net/help:api — anonymous: 2 tags/req, requests need descriptive UA.


// e621 "sample" of an animated post (webm/mp4) IS the video file — an <img>
// cover must be a real image, so fall back to the always-image preview.
function imageOrPreview(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    if (/\.(webm|mp4|mov|mkv)(\?|$)/i.test(c)) continue;
    return c;
  }
  return null;
}

interface E621Post {
  id: number;
  created_at: string;
  rating: string;
  score: { total?: number };
  fav_count?: number;
  file: { url: string; ext: string; width: number; height: number };
  sample?: { has: boolean; url: string | null };
  preview: { url: string };
  tags: Record<string, string[]>;
  description?: string;
  sources?: string[];
}

function e621Normalize(p: E621Post): LiveSearchItem | null {
  const tags = [
    ...(p.tags?.artist ?? []),
    ...(p.tags?.general ?? []),
    ...(p.tags?.species ?? []),
    ...(p.tags?.character ?? []),
  ];
  if (hasBlockedTag(tags)) return null;
  const year = new Date(p.created_at).getFullYear();
  return {
    externalId: String(p.id),
    title: p.tags?.artist?.length
      ? `${p.tags.artist.join(", ")} — #${p.id}`
      : `e621 post #${p.id}`,
    description: (p.description ?? "").replace(/\[\/?[a-z=/]+\]/g, "").slice(0, 800) || null,
    coverUrl: imageOrPreview(p.sample?.url, p.preview.url),
    bannerUrl: imageOrPreview(p.file.url, p.sample?.url, p.preview.url),
    category: "ILLUSTRATION",
    format: p.file.ext.toUpperCase(),
    year,
    popularity: p.fav_count ?? p.score?.total ?? 0,
    tags: tags.slice(0, 24),
    creator: p.tags?.artist?.[0] ?? null,
    externalUrl: `https://e621.net/posts/${p.id}`,
    extra: { width: p.file.width, height: p.file.height, rating: p.rating, source: "e621" },
    galleryCount: 1,
  };
}

/** e621 transport: system curl first (Cloudflare TLS-fingerprint friendly),
 * falls back to standard fetch. Real requests to the documented API either way. */
async function e621Request<T>(url: string): Promise<T> {
  try {
    return await curlJson<T>(url);
  } catch {
    return await liveJson<T>(url, { ua: PLATFORM_UA });
  }
}

async function e621Details(externalId: string): Promise<LiveSearchItem | null> {
  const data = await e621Request<{ post?: E621Post }>(`https://e621.net/posts/${externalId}.json`);
  return data.post ? e621Normalize(data.post) : null;
}

export const e621Adapter: LiveAdapter = {
  id: "e621",
  integration:
    "Official documented REST API (e621.net/help:api), anonymous read access with descriptive User-Agent. Metadata + publicly served image URLs; safety tag filter applied client-side.",

  async ping() {
    await e621Request<{ posts: E621Post[] }>("https://e621.net/posts.json?limit=1");
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const tags = q.trim() ? `${q.trim()} rating:explicit` : "order:score rating:explicit";
    const url = `https://e621.net/posts.json?limit=40&page=${page}&tags=${encodeURIComponent(tags)}`;
    const data = await e621Request<{ posts: E621Post[] }>(url);
    return data.posts.map(e621Normalize).filter((x): x is LiveSearchItem => x !== null);
  },

  async popular(opts) {
    return e621Adapter.search("order:score", opts);
  },

  async details(externalId) {
    return e621Details(externalId);
  },

  async units(externalId) {
    const raw = await e621Request<{ post?: E621Post }>(`https://e621.net/posts/${externalId}.json`);
    const p = raw.post;
    if (!p) return null;
    const units: LiveUnits = {
      images: [
        {
          url: p.file.url,
          thumbUrl: imageOrPreview(p.sample?.url, p.preview.url) ?? undefined,
          width: p.file.width,
          height: p.file.height,
          tags: [...(p.tags?.artist ?? []), ...(p.tags?.general ?? []).slice(0, 20)],
        },
      ],
    };
    return units;
  },
};

// ─── yande.re (Moebooru JSON) ───

interface MoebooruPost {
  id: number;
  created_at?: { s?: string };
  rating: string;
  score: number;
  file_url: string;
  sample_url: string;
  preview_url: string;
  width: number;
  height: number;
  source?: string;
  tags: string;
  author?: string;
}

function moeNormalize(p: MoebooruPost, host: string, base: string): LiveSearchItem | null {
  const tags = parseTagString(p.tags);
  if (hasBlockedTag(tags)) return null;
  return {
    externalId: String(p.id),
    title: tags.find((t) => !t.includes(":")) ? `${tags.slice(0, 3).join(", ")} — #${p.id}` : `${host} post #${p.id}`,
    coverUrl: p.preview_url || p.sample_url,
    bannerUrl: p.sample_url,
    category: "ILLUSTRATION",
    format: "IMAGE",
    popularity: p.score,
    tags: tags.slice(0, 24),
    creator: p.author ?? null,
    externalUrl: `${base}/post/show/${p.id}`,
    extra: { width: p.width, height: p.height, rating: p.rating, source: host },
    galleryCount: 1,
  };
}

export const yandereAdapter: LiveAdapter = {
  id: "yandere",
  integration:
    "Moebooru public JSON API (yande.re/post.json), anonymous read access. Metadata + publicly served image URLs; safety tag filter applied client-side.",

  async ping() {
    await liveJson<MoebooruPost[]>("https://yande.re/post.json?limit=1");
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    // VERIFIED(2025): Moebooru matches tags exactly, so `q rating:explicit`
    // returns empty whenever the queried tag has no explicit posts (e.g.
    // "fate" on yande.re). Search explicit first, fall back to unfiltered;
    // hasBlockedTag() still filters disallowed content either way.
    const base = q.trim();
    const explicit = base ? `${base} rating:explicit` : "rating:explicit order:score";
    const url = `https://yande.re/post.json?limit=40&page=${page}&tags=${encodeURIComponent(explicit)}`;
    let data = await liveJson<MoebooruPost[]>(url);
    if (!data.length && base) {
      const fallbackUrl = `https://yande.re/post.json?limit=40&page=${page}&tags=${encodeURIComponent(base)}`;
      data = await liveJson<MoebooruPost[]>(fallbackUrl);
    }
    return data.map((p) => moeNormalize(p, "yande.re", "https://yande.re")).filter(
      (x): x is LiveSearchItem => x !== null,
    );
  },

  async popular(opts) {
    return yandereAdapter.search("order:score", opts);
  },

  async units(externalId) {
    const data = await liveJson<MoebooruPost[]>(`https://yande.re/post.json?tags=id:${externalId}&limit=1`);
    const p = data[0];
    if (!p) return null;
    return {
      images: [{ url: p.file_url, thumbUrl: p.sample_url, width: p.width, height: p.height, tags: parseTagString(p.tags) }],
    };
  },
};

// ─── Hypnohub (Gelbooru 0.2 dapi JSON) ───

interface DapiPost {
  preview_url?: string | null;
  sample_url?: string | null;
  file_url?: string | null;
  image?: string;
  width?: number | string;
  height?: number | string;
  id: number | string;
  score?: number | string;
  rating?: string;
  tags?: string;
  owner?: string;
  created_at?: string;
  source?: string;
  directory?: string;
  hash?: string;
}

function dapiNormalize(p: DapiPost, host: string, base: string): LiveSearchItem | null {
  const tags = parseTagString(p.tags ?? "");
  if (hasBlockedTag(tags)) return null;
  return {
    externalId: String(p.id),
    title: tags.length ? `${tags.slice(0, 3).join(", ")} — #${p.id}` : `${host} post #${p.id}`,
    coverUrl: imageOrPreview(p.preview_url, p.sample_url),
    bannerUrl: imageOrPreview(p.sample_url, p.preview_url, p.file_url),
    category: "ILLUSTRATION",
    format: "IMAGE",
    popularity: Number(p.score ?? 0),
    tags: tags.slice(0, 24),
    creator: p.owner ?? null,
    externalUrl: `${base}/index.php?page=post&s=view&id=${p.id}`,
    extra: {
      width: Number(p.width ?? 0), height: Number(p.height ?? 0),
      rating: p.rating, source: host,
    },
    galleryCount: 1,
  };
}

/**
 * VERIFIED(2025): hypnohub dapi returns HTTP 200 with a ZERO-BYTE body
 * (not `[]`) whenever a tag combination matches zero posts. JSON.parse on
 * that body throws "Unexpected end of JSON input". Treat empty text as an
 * empty result set.
 */
async function dapiJson(url: string): Promise<DapiPost[]> {
  const text = await liveText(url, { headers: { Accept: "application/json" } });
  if (!text.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as DapiPost[]) : [];
  } catch {
    throw new LiveFetchError(502, "Hypnohub returned non-JSON payload");
  }
}

export const hypnohubAdapter: LiveAdapter = {
  id: "hypnohub",
  integration:
    "Gelbooru-0.2 public dapi JSON endpoint (index.php?page=dapi&s=post&q=index&json=1), anonymous read access. Metadata + publicly served image URLs; safety tag filter applied client-side.",

  async ping() {
    const r = await dapiJson(
      "https://hypnohub.net/index.php?page=dapi&s=post&q=index&json=1&limit=1",
    );
    if (!r.length) throw new LiveFetchError(502, "Hypnohub returned unexpected payload");
  },

  async search(q, opts) {
    const page = Math.max(0, (opts?.page ?? 1) - 1); // dapi pages are 0-based
    const base = q.trim();
    // VERIFIED(2025): like Moebooru, `q rating:explicit` empties results when
    // the tag has no explicit posts — try explicit first, fall back unfiltered.
    const tags = base ? `${base} rating:explicit` : "rating:explicit order:score";
    const url = `https://hypnohub.net/index.php?page=dapi&s=post&q=index&json=1&limit=40&pid=${page}&tags=${encodeURIComponent(tags)}`;
    let data = await dapiJson(url);
    if (!data.length && base) {
      const fallbackUrl = `https://hypnohub.net/index.php?page=dapi&s=post&q=index&json=1&limit=40&pid=${page}&tags=${encodeURIComponent(base)}`;
      data = await dapiJson(fallbackUrl);
    }
    return data.map((p) => dapiNormalize(p, "hypnohub.net", "https://hypnohub.net")).filter(
      (x): x is LiveSearchItem => x !== null,
    );
  },

  async popular(opts) {
    return hypnohubAdapter.search("score:>=50", opts);
  },

  async units(externalId) {
    const data = await liveJson<DapiPost[]>(
      `https://hypnohub.net/index.php?page=dapi&s=post&q=index&json=1&limit=1&id=${externalId}`,
    );
    const p = data?.[0];
    if (!p || !p.file_url) return null;
    return {
      images: [{
        url: p.file_url,
        thumbUrl: p.sample_url ?? p.preview_url ?? undefined,
        width: Number(p.width ?? 0),
        height: Number(p.height ?? 0),
        tags: parseTagString(p.tags ?? ""),
      }],
    };
  },
};

// ─── Gelbooru (dapi JSON, requires free API key) ───

export interface GelbooruConfig { user_id?: string; api_key?: string }

function gelbooruAuthQuery(config?: Record<string, string>): string {
  const uid = config?.user_id?.trim();
  const key = config?.api_key?.trim();
  if (!uid || !key) {
    throw new LiveFetchError(
      401,
      "Gelbooru requires a free API key — set user_id and api_key in the provider settings.",
    );
  }
  return `&user_id=${encodeURIComponent(uid)}&api_key=${encodeURIComponent(key)}`;
}

export const gelbooruAdapter: LiveAdapter = {
  id: "gelbooru",
  integration:
    "Gelbooru-0.2 dapi JSON API. Gelbooru requires a FREE account API key (user_id + api_key) — configure both in the extension settings before use. Without credentials the upstream answers 401; this adapter reports that honestly instead of simulating results.",

  async ping() {
    // A config-less ping is expected to fail with 401; the engine checks
    // configuration first and reports the honest error message.
    await liveJson<DapiPost[]>(
      "https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=1",
    );
  },

  async search(q, opts: SearchOpts = {}) {
    const auth = gelbooruAuthQuery(opts.config);
    const page = Math.max(0, (opts.page ?? 1) - 1);
    const tags = q.trim() ? `${q.trim()} rating:explicit` : "rating:explicit";
    const url = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=40&pid=${page}&tags=${encodeURIComponent(tags)}${auth}`;
    const data = await liveJson<{ post?: DapiPost[] }>(url);
    return (data.post ?? []).map((p) => dapiNormalize(p, "gelbooru.com", "https://gelbooru.com")).filter(
      (x): x is LiveSearchItem => x !== null,
    );
  },

  async popular(opts) {
    return gelbooruAdapter.search("score:>=100", opts);
  },

  async units(externalId) {
    const data = await liveJson<{ post?: DapiPost[] }>(
      `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=1&id=${externalId}`,
    );
    const p = data.post?.[0];
    if (!p || !p.file_url) return null;
    return {
      images: [{
        url: p.file_url,
        thumbUrl: p.sample_url ?? p.preview_url ?? undefined,
        width: Number(p.width ?? 0),
        height: Number(p.height ?? 0),
        tags: parseTagString(p.tags ?? ""),
      }],
    };
  },
};

export { gelbooruAuthQuery };
