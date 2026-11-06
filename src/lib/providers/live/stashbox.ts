// Stash-box family — StashDB, JAVStash, FansDB, PMV Stash.
//
// All four are instances of the same open-source metadata service
// (stash-box, source: github.com/stashapp/stash-box), each with a GraphQL
// API at https://<host>/graphql documented at docs.stashapp.cc.
//
// VERIFIED from sandbox (2025):
//  - All four endpoints respond with valid GraphQL responses at /graphql.
//  - EVERY query (including `version`) returns `{"errors":[{"message":
//    "not authorized"}]}` without an API key — the service is fully
//    auth-gated. Stash-box issues free API keys to registered accounts
//    (StashDB: stashdb.org → Settings → API key).
//  - Because no query is executable anonymously, schema correctness can
//    NOT be fully verified from this sandbox. The queries below follow the
//    published stash-box schema (searchScene, scene, queryScenes) and the
//    client surfaces upstream GraphQL errors verbatim — with a key set,
//    errors would be explicit, never silent fakes.
//
// Subcategory contract (user requirement): AV / JAV / PMV / HMV / CREATOR
// stay DISTINCT video subcategories and are never merged into Anime.
// These adapters are METADATA ONLY — scenes are not streamed; the UI links
// out to the scene's recorded official URLs (playback availability is a
// separate, clearly labeled concept).

import { LiveFetchError, livePostJson } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

interface StashImage { url?: string | null; width?: number | null; height?: number | null }
interface StashPerformer { name?: string | null }
interface StashTag { name?: string | null }
interface StashUrl { url?: string | null; type?: string | null }
interface StashStudio { name?: string | null }
interface StashScene {
  id: string;
  title?: string | null;
  details?: string | null;
  date?: string | null;
  release_date?: string | null;
  duration?: number | null;
  urls?: StashUrl[] | null;
  studio?: StashStudio | null;
  images?: StashImage[] | null;
  performers?: (StashPerformer & { performer?: StashPerformer })[] | null;
  tags?: StashTag[] | null;
}

const SCENE_FIELDS = `
  id title details date release_date duration
  urls { url type }
  studio { name }
  images { url width height }
  performers { performer { name } }
  tags { name }
`;

const SEARCH_QUERY = `query($t: String!) { searchScene(term: $t) { ${SCENE_FIELDS} } }`;
const DETAILS_QUERY = `query($id: ID!) { scene(id: $id) { ${SCENE_FIELDS} } }`;
const LIST_QUERY = `query($i: SceneQueryInput!) { queryScenes(input: $i) { count scenes { ${SCENE_FIELDS} } } }`;

/** Factory: one adapter per stash-box instance, each with its own API key config. */
interface StashBoxOpts {
  apiKey?: string;
}

async function gql<T>(host: string, query: string, variables: Record<string, unknown>, opts: StashBoxOpts): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Stash-box authenticates with `Authorization: ApiKey <key>` (docs.stashapp.cc).
  if (opts.apiKey) headers.Authorization = `ApiKey ${opts.apiKey}`;
  try {
    const data = await livePostJson<{ data?: T; errors?: { message: string }[] }>(
      `https://${host}/graphql`,
      { query, variables },
      { headers, timeoutMs: 15_000 },
    );
    if (data.errors?.length) {
      const msg = data.errors.map((e) => e.message).join("; ").slice(0, 200);
      throw new LiveFetchError(/not authorized/i.test(msg) ? 401 : 502, `stash-box[${host}]: ${msg}`);
    }
    return (data.data ?? {}) as T;
  } catch (e) {
    if (e instanceof LiveFetchError) throw e;
    throw new LiveFetchError(502, `stash-box[${host}] request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function sceneUrl(scene: StashScene, host: string): string {
  const official = scene.urls?.find((u) => /stashdb\.org|javstash\.org|fansdb\.cc|pmvstash\.org/i.test(u.url ?? ""));
  if (official?.url) return official.url;
  // Deep link to the scene page on the instance that served the record.
  return `https://${host}/scenes/${scene.id}`;
}

function normalizeScene(scene: StashScene, host: string, videoKind: string, category = "AV"): LiveSearchItem {
  const performers = (scene.performers ?? [])
    .map((p) => p.performer?.name ?? p.name ?? null)
    .filter((x): x is string => !!x);
  const year = scene.date || scene.release_date ? Number((scene.date ?? scene.release_date ?? "").slice(0, 4)) || null : null;
  const cover = scene.images?.[0]?.url ?? null;
  return {
    externalId: String(scene.id),
    title: scene.title || `Scene ${scene.id}`,
    altTitles: [],
    description: scene.details ?? null,
    coverUrl: cover,
    category,
    format: "Scene",
    status: null,
    year,
    popularity: 0,
    tags: (scene.tags ?? []).map((t) => t.name ?? "").filter(Boolean).slice(0, 30),
    studio: scene.studio?.name ?? null,
    creator: performers.slice(0, 3).join(", ") || null,
    externalUrl: sceneUrl(scene, host),
    videoKind,
    extra: {
      source: host,
      videoKind,
      durationSec: scene.duration ?? null,
      releaseDate: scene.date ?? scene.release_date ?? null,
      performers,
      sceneUrls: (scene.urls ?? []).map((u) => ({ label: u.type ?? "site", url: u.url })).filter((u) => u.url),
      metadataOnly: true, // UI must present playback as external action
    },
  };
}

/** Factory: one adapter per stash-box instance, each with its own API key config. */
export function makeStashBoxAdapter(cfg: {
  id: string;
  host: string;
  name: string;
  videoKind: string;
  description: string;
}): LiveAdapter {
  return {
    id: cfg.id,
    integration:
      `Official stash-box GraphQL API (https://${cfg.host}/graphql, documented at docs.stashapp.cc). ` +
      "REQUIRES A FREE API KEY: register at the site, create a key in account settings, paste it into this provider's config. " +
      "Verified from sandbox: endpoint answers GraphQL on all four instances; every read is auth-gated (\"not authorized\" without key), so schema queries follow the published stash-box schema and surface upstream errors verbatim. " +
      "Metadata only (scenes, performers, studios, tags) — no streams; playback stays an explicit external action. " +
      `Subcategory: ${cfg.videoKind}. ${cfg.description}`,

    async ping(config) {
      const apiKey = config?.apiKey?.trim() || undefined;
      if (!apiKey) {
        throw new LiveFetchError(
          401,
          `${cfg.name} needs a free API key — register at ${cfg.host}, create it in account settings, and set "apiKey" in this provider's config. Endpoint is verified live; all reads are auth-gated.`,
        );
      }
      // `version` is the cheapest authenticated query.
      await gql<{ version: { version: string } }>(cfg.host, "query{version{version}}", {}, { apiKey });
    },

    async search(q, opts) {
      const apiKey = opts?.config?.apiKey?.trim() || undefined;
      if (!apiKey) {
        throw new LiveFetchError(
          401,
          `${cfg.name} needs a free API key — set "apiKey" in the provider config (register at ${cfg.host}).`,
        );
      }
      if (!q.trim()) {
        // Browse = newest scenes (documented SceneQueryInput: sort DATE desc).
        const data = await gql<{ queryScenes: { scenes: StashScene[] } }>(
          cfg.host, LIST_QUERY,
          { i: { sort: "DATE", direction: "DESC", per_page: 24, page: Math.max(1, opts?.page ?? 1) } },
          { apiKey },
        );
        return data.queryScenes.scenes.map((s) => normalizeScene(s, cfg.host, cfg.videoKind));
      }
      const data = await gql<{ searchScene: StashScene[] }>(cfg.host, SEARCH_QUERY, { t: q.trim() }, { apiKey });
      return (data.searchScene ?? []).map((s) => normalizeScene(s, cfg.host, cfg.videoKind));
    },

    async popular(opts) {
      return this.search!("", { page: opts?.page });
    },

    async details(externalId, opts) {
      const apiKey = opts?.config?.apiKey?.trim() || undefined;
      if (!apiKey) return null;
      const data = await gql<{ scene: StashScene | null }>(cfg.host, DETAILS_QUERY, { id: externalId }, { apiKey });
      return data.scene ? normalizeScene(data.scene, cfg.host, cfg.videoKind) : null;
    },

    // Metadata database — no chapters/images/streams are materialized.
    async units(): Promise<LiveUnits | null> {
      return null;
    },
  };
}

export const stashDbAdapter = makeStashBoxAdapter({
  id: "stashdb", host: "stashdb.org", name: "StashDB", videoKind: "AV",
  description: "Community-run scene/performer/studio database for general adult video.",
});
export const javStashAdapter = makeStashBoxAdapter({
  id: "javstash", host: "javstash.org", name: "JAVStash", videoKind: "JAV",
  description: "JAV-specialized stash-box: scene metadata keyed to JAV release IDs.",
});
export const fansDbAdapter = makeStashBoxAdapter({
  id: "fansdb", host: "fansdb.cc", name: "FansDB", videoKind: "CREATOR",
  description: "Independent/indie creator scene metadata (ManyVids, Clips4Sale-style releases).",
});
export const pmvStashAdapter = makeStashBoxAdapter({
  id: "pmvstash", host: "pmvstash.org", name: "PMV Stash", videoKind: "PMV",
  description: "PMV/HMV (edited music-video compilations) scene metadata.",
});
