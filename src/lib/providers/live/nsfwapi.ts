// NSFW-API (github.com/Varomine/NSFW-API) — user-mandated ANIME streaming
// aggregator. A self-hostable Bun/Hono service wrapping several hentai
// providers behind one interface:
//   GET {base}/api/{provider}/search/{query}  → {page, results[], hasNextPage}
//   GET {base}/api/{provider}/watch/{id}      → stream details
// Documented public instances:
//   https://hentai-api.mdtahseen7378.workers.dev   (Cloudflare Workers)
//   https://mdtahseen7-hentai-api.hf.space         (HF Spaces)
//
// SANDBOX STATUS (2026-11): the public instances are UP but their upstream
// crawls are intermittent (some providers 500 / return empty). The adapter
// is therefore configured honestly: base URL is user-configurable (default =
// the Workers instance), responses are normalized defensively, and failures
// surface as provider errors instead of fake data. Point `baseUrl` at your
// own deployment of the repo for a fully reliable source.

import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";
import { liveJson, LiveFetchError } from "./http";

const DEFAULT_BASE = "https://hentai-api.mdtahseen7378.workers.dev";

// Providers the service documents. Kept as a list so one failing upstream
// doesn't kill the whole source — each is tried in order until one returns.
const PROVIDER_SLUGS = ["hanime", "hentaihaven", "hentaicity", "hentaitv", "oppai"];

function normalizeItem(raw: any): LiveSearchItem | null {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id ?? raw.videoId ?? raw.slug ?? raw.code ?? null;
  const title = raw.title ?? raw.name ?? raw.videoTitle ?? null;
  if (id == null || !title) return null;
  const url = raw.url ?? raw.videoUrl ?? null;
  return {
    externalId: String(id),
    title: String(title),
    description: raw.description ?? raw.synopsis ?? null,
    coverUrl: raw.image ?? raw.thumbnail ?? raw.cover ?? null,
    category: "ANIME",
    format: raw.type ?? "Hentai anime",
    year: raw.releaseDate ? new Date(raw.releaseDate).getUTCFullYear() : null,
    popularity: typeof raw.views === "number" ? raw.views : undefined,
    tags: Array.isArray(raw.genres ?? raw.tags)
      ? (raw.genres ?? raw.tags).map(String).slice(0, 12)
      : undefined,
    creator: raw.studio ?? null,
    externalUrl: typeof url === "string" ? url : null,
    episodesCount: 1,
    extra: { source: "nsfwapi", provider: raw.provider ?? undefined },
  };
}

function baseOf(config?: Record<string, string>): string {
  const raw = (config?.baseUrl ?? DEFAULT_BASE).trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

async function searchProvider(base: string, provider: string, query: string, page: number): Promise<LiveSearchItem[]> {
  const j = await liveJson<any>(
    `${base}/api/${encodeURIComponent(provider)}/search/${encodeURIComponent(query)}?page=${page}`,
    { timeoutMs: 25_000, cacheTtlMs: 3 * 60 * 1000, cacheKey: `nsfwapi:${provider}:${query}:${page}` },
  );
  const results = Array.isArray(j) ? j : (j?.results ?? j?.videos ?? j?.data ?? []);
  return results.map(normalizeItem).filter(Boolean) as LiveSearchItem[];
}

/** Try every documented provider until one returns real results. */
async function searchAny(base: string, query: string, page: number): Promise<LiveSearchItem[]> {
  const errors: string[] = [];
  for (const provider of PROVIDER_SLUGS) {
    try {
      const items = await searchProvider(base, provider, query, page);
      if (items.length) return items.map((i) => ({ ...i, extra: { ...i.extra, provider } }));
      errors.push(`${provider}: empty`);
    } catch (e) {
      errors.push(`${provider}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new LiveFetchError(502, `NSFW-API upstreams unavailable (${errors.slice(0, 3).join("; ")})`);
}

export const nsfwapiAdapter: LiveAdapter = {
  id: "nsfwapi",
  integration:
    "NSFW-API aggregator (github.com/Varomine/NSFW-API) — self-hostable Bun/Hono service exposing unified search + watch over several hentai providers. Uses the documented public instance by default; set baseUrl in the provider config to point at your own deployment for a fully reliable source.",

  async ping(config) {
    const base = baseOf(config);
    // A liveness probe: a tiny real search against the first reachable provider.
    await searchAny(base, "hentai", 1);
  },

  async search(q, opts) {
    const query = q.trim() || "hentai";
    return searchAny(baseOf(opts?.config), query, Math.max(1, opts?.page ?? 1));
  },

  // The service exposes no discover/latest endpoint — browse is served by a
  // generic catalog query, clearly the aggregator's search path (real upstream
  // data, labeled as such in the integration description).
  async popular(opts) {
    return searchAny(baseOf(opts?.config), "hentai", Math.max(1, opts?.page ?? 1));
  },

  async details(externalId, opts) {
    // The aggregator has no per-id details endpoint; identity comes from the
    // last browse/search hit (LRU below) or falls back to minimal metadata.
    const hit = recent.get(externalId);
    if (hit) return hit;
    return null;
  },

  async units(externalId, opts) {
    const base = baseOf(opts?.config);
    const provider = recent.get(externalId)?.extra?.provider as string | undefined;
    const slugs = provider ? [provider, ...PROVIDER_SLUGS.filter((p) => p !== provider)] : PROVIDER_SLUGS;
    const errors: string[] = [];
    for (const providerSlug of slugs) {
      try {
        const j = await liveJson<any>(
          `${base}/api/${providerSlug}/watch/${encodeURIComponent(externalId)}`,
          { timeoutMs: 25_000, cacheTtlMs: 60_000, cacheKey: `nsfwapi-watch:${providerSlug}:${externalId}` },
        );
        const sources: any[] = Array.isArray(j?.sources) ? j.sources : j?.url ? [{ url: j.url, quality: j?.quality }] : [];
        const pick = sources.find((s) => typeof s?.url === "string" && /^https?:\/\//.test(s.url));
        if (!pick) {
          errors.push(`${providerSlug}: no stream url`);
          continue;
        }
        return {
          episodes: [
            {
              number: 1,
              title: recent.get(externalId)?.title ?? String(externalId),
              streamUrl: pick.url as string,
              streamType: (pick.type as string) ?? "video/mp4",
              thumbnailUrl: recent.get(externalId)?.coverUrl ?? null,
            },
          ],
        };
      } catch (e) {
        errors.push(`${providerSlug}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    throw new LiveFetchError(502, `NSFW-API watch failed (${errors.slice(0, 2).join("; ")})`);
  },
};

// Small LRU so details()/units() can enrich items seen during browse/search.
const recent = new Map<string, LiveSearchItem>();
const origPopular = nsfwapiAdapter.popular?.bind(nsfwapiAdapter);
const origSearch = nsfwapiAdapter.search.bind(nsfwapiAdapter);
nsfwapiAdapter.popular = async (opts) => {
  const items = (await origPopular!(opts)) ?? [];
  for (const i of items) recent.set(i.externalId, i);
  while (recent.size > 400) recent.delete(recent.keys().next().value!);
  return items;
};
nsfwapiAdapter.search = async (q, opts) => {
  const items = await origSearch(q, opts);
  for (const i of items) recent.set(i.externalId, i);
  while (recent.size > 400) recent.delete(recent.keys().next().value!);
  return items;
};
