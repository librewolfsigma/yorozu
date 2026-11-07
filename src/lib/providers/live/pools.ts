// e621 Pools — curated multi-image collections ("pools") via e621's official
// public API (e621.net/pools.json, documented at e621.net/help:api).
//
// TAXONOMY (user-corrected): image COLLECTIONS are a distinct category from
// single booru images (ILLUSTRATION) and from manga/doujin. A pool is an
// ordered set of images — cover grid → collection viewer UI, not a reader.
//
// Verified live from this deployment (2026-11): pools.json 200 anonymous,
// supports ?page=N&limit=N&search[name_contains]=&search[order]=.
// Pool entries carry post_ids; covers are batch-fetched with ONE extra
// posts.json call per listing page (`tags=id:a,b,c` counts as one tag).

import { curlJson, PLATFORM_UA, liveJson } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";
import { hasBlockedTag } from "./booru";

const BASE = "https://e621.net";

async function e621Get<T>(url: string): Promise<T> {
  try {
    return await curlJson<T>(url);
  } catch {
    return await liveJson<T>(url, { ua: PLATFORM_UA });
  }
}

interface E621Pool {
  id: number;
  name: string;
  description?: string;
  is_active?: boolean;
  category?: string;
  post_ids?: number[];
  post_count?: number;
  creator_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface E621PostLike {
  id: number;
  file?: { url?: string; ext?: string; width?: number; height?: number };
  sample?: { has?: boolean; url?: string | null };
  preview?: { url?: string };
  tags?: Record<string, string[]>;
  score?: { total?: number };
  fav_count?: number;
}

function poolTitle(name: string): string {
  return name.replace(/_/g, " ");
}

/** One batched posts.json call resolves covers for a whole listing page. */
async function coversForPosts(ids: number[]): Promise<Map<number, E621PostLike>> {
  const byId = new Map<number, E621PostLike>();
  const take = ids.slice(0, 24).filter((n) => Number.isFinite(n) && n > 0);
  if (!take.length) return byId;
  try {
    const data = await e621Get<{ posts?: E621PostLike[] }>(
      `${BASE}/posts.json?limit=${take.length}&tags=${encodeURIComponent(`id:${take.join(",")}`)}`,
    );
    for (const p of data.posts ?? []) byId.set(p.id, p);
  } catch {
    // covers are cosmetic — a failed batch never kills the listing
  }
  return byId;
}

function thumbOf(p: E621PostLike): string | null {
  return p.sample?.url || p.preview?.url || p.file?.url || null;
}

async function normalizePools(pools: E621Pool[]): Promise<LiveSearchItem[]> {
  const coverIds = pools.map((p) => p.post_ids?.[0] ?? 0);
  const covers = await coversForPosts(coverIds);
  const items: LiveSearchItem[] = [];
  for (const pool of pools) {
    const count = pool.post_count ?? pool.post_ids?.length ?? 0;
    if (count <= 0) continue;
    const post = covers.get(pool.post_ids?.[0] ?? -1);
    const tags = [...(post?.tags?.artist ?? []).slice(0, 4)];
    if (tags.some((t) => hasBlockedTag([t]))) continue;
    items.push({
      externalId: String(pool.id),
      title: poolTitle(pool.name),
      description: (pool.description ?? "").replace(/\[\/?[a-z=/]+\]/g, "").slice(0, 600) || null,
      coverUrl: post ? thumbOf(post) : null,
      category: "GALLERY",
      format: "COLLECTION",
      status: pool.is_active === false ? "COMPLETED" : "ONGOING",
      year: pool.created_at ? new Date(pool.created_at).getFullYear() : null,
      popularity: count,
      creator: pool.creator_name ?? null,
      tags,
      externalUrl: `${BASE}/pools/${pool.id}`,
      extra: { postCount: count, poolCategory: pool.category ?? "series", source: "e621-pools" },
      galleryCount: count,
    });
  }
  return items;
}

export const e621PoolsAdapter: LiveAdapter = {
  id: "e621-pools",
  integration:
    "e621 official public pools API (e621.net/pools.json, anonymous read with descriptive User-Agent). Real curated multi-image collections with real titles, creators and post counts; images load from e621 through the image proxy.",

  async ping() {
    const data = await e621Get<E621Pool[]>(`${BASE}/pools.json?limit=1`);
    if (!Array.isArray(data)) throw new Error("e621-pools: unexpected upstream payload");
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const order = "updated_at";
    // NOTE: brackets are percent-encoded — curl treats raw [] as glob ranges
    // (and this keeps the URL identical across the curl and fetch transports).
    const nameQuery = q.trim()
      ? `&search%5Bname_contains%5D=${encodeURIComponent(q.trim())}`
      : "";
    const url = `${BASE}/pools.json?limit=24&page=${page}&search%5Border%5D=${order}&search%5Bis_active%5D=true${nameQuery}`;
    const data = await e621Get<E621Pool[]>(url);
    return normalizePools(data);
  },

  async popular(opts) {
    return e621PoolsAdapter.search("", opts);
  },

  async details(externalId) {
    const data = await e621Get<E621Pool>(`${BASE}/pools/${externalId}.json`);
    if (!data?.id) return null;
    const [item] = await normalizePools([data]);
    return item ?? null;
  },

  async units(externalId) {
    // Pool → real posts via the pool:{id} metatag, then one collection viewer payload.
    const page = await e621Get<{ posts?: E621PostLike[] }>(
      `${BASE}/posts.json?limit=320&tags=${encodeURIComponent(`pool:${externalId} order:id`)}`,
    );
    const images = (page.posts ?? [])
      .filter((p) => p.file?.url)
      .map((p) => {
        const tags = [
          ...(p.tags?.artist ?? []),
          ...(p.tags?.character ?? []),
          ...(p.tags?.general ?? []).slice(0, 16),
        ];
        return {
          url: p.file!.url!,
          thumbUrl: thumbOf(p) ?? undefined,
          width: p.file?.width ?? 800,
          height: p.file?.height ?? 1200,
          tags,
        };
      });
    if (!images.length) return null;
    return { images };
  },
};
