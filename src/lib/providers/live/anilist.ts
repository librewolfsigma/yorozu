// AniList — public GraphQL API (https://docs.anilist.co), no auth for reads.
// Used as the anime metadata backbone (adult/hentai titles flagged isAdult).
// VERIFIED from sandbox: POST https://graphql.anilist.co returns real data.

import { LiveFetchError, livePostJson } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

const ENDPOINT = "https://graphql.anilist.co";

interface AniListMedia {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms?: string[];
  description?: string | null;
  coverImage?: { extraLarge?: string; large?: string } | null;
  bannerImage?: string | null;
  format?: string | null;
  status?: string | null;
  seasonYear?: number | null;
  averageScore?: number | null;
  popularity?: number | null;
  genres?: string[];
  studios?: { nodes?: { name?: string }[] } | null;
  episodes?: number | null;
  duration?: number | null;
  siteUrl?: string | null;
  isAdult?: boolean;
}

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  synonyms
  description(asHtml: false)
  coverImage { extraLarge large }
  bannerImage
  format
  status
  seasonYear
  averageScore
  popularity
  genres
  studios(isMain: true) { nodes { name } }
  episodes
  duration
  siteUrl
  isAdult
`;

function normalize(m: AniListMedia): LiveSearchItem {
  return {
    externalId: String(m.id),
    title: m.title.english || m.title.romaji || m.title.native || `AniList #${m.id}`,
    altTitles: [m.title.romaji, m.title.native, ...(m.synonyms ?? [])].filter(
      (t): t is string => !!t,
    ),
    description: m.description ? m.description.replace(/<[^>]*>/g, "").trim().slice(0, 1500) : null,
    coverUrl: m.coverImage?.extraLarge || m.coverImage?.large || null,
    bannerUrl: m.bannerImage ?? null,
    category: "ANIME",
    format: m.format ?? null,
    status: m.status ?? null,
    year: m.seasonYear ?? null,
    score: m.averageScore != null ? m.averageScore / 10 : null,
    popularity: m.popularity ?? 0,
    genres: m.genres ?? [],
    studio: m.studios?.nodes?.[0]?.name ?? null,
    episodesCount: m.episodes ?? null,
    externalUrl: m.siteUrl ?? `https://anilist.co/anime/${m.id}`,
    extra: { source: "anilist", isAdult: m.isAdult ?? true, durationMin: m.duration ?? null },
  };
}

async function gql(query: string, variables: Record<string, unknown>): Promise<{ Page?: { media?: AniListMedia[] }; Media?: AniListMedia | null }> {
  try {
    const data = await livePostJson<{ data: typeof DEFAULT }>(ENDPOINT, { query, variables }, {
      headers: { Accept: "application/json" },
      ua: "YozoraPlatform/1.0 (AniList provider; +https://github.com/librewolfsigma/yozora)",
      timeoutMs: 15_000,
    });
    return (data.data ?? {}) as { Page?: { media?: AniListMedia[] }; Media?: AniListMedia | null };
  } catch (e) {
    if (e instanceof LiveFetchError) throw e;
    throw new LiveFetchError(502, `AniList request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const DEFAULT: { Page?: { media?: AniListMedia[] }; Media?: AniListMedia | null } = {};

export const anilistAdapter: LiveAdapter = {
  id: "anilist",
  integration:
    "Official public GraphQL API (graphql.anilist.co, documented at docs.anilist.co). Read-only metadata; no auth required for reads. Streaming is NOT provided — playback stays an explicit external-link action.",

  async ping() {
    await gql("query{Page(perPage:1){media(id:1){id}}}", {});
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    if (!q.trim()) return anilistAdapter.popular!({ page });
    const data = await gql(
      `query($q:String,$page:Int){Page(page:$page,perPage:20){media(search:$q,genre_in:["Hentai"],type:ANIME,sort:SEARCH_MATCH){${MEDIA_FIELDS}}}}`,
      { q, page },
    );
    return (data.Page?.media ?? []).map(normalize);
  },

  async popular(opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const data = await gql(
      `query($page:Int){Page(page:$page,perPage:20){media(genre_in:["Hentai"],type:ANIME,sort:POPULARITY_DESC){${MEDIA_FIELDS}}}}`,
      { page },
    );
    return (data.Page?.media ?? []).map(normalize);
  },

  async details(externalId) {
    const data = await gql(`query($id:Int){Media(id:$id,type:ANIME){${MEDIA_FIELDS}}}`, { id: Number(externalId) });
    return data.Media ? normalize(data.Media) : null;
  },

  // No units: AniList is a metadata database; it does not license streams.
  async units() {
    return null;
  },
};
