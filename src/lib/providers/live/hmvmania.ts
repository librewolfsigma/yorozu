// HMVmania — user-mandated HMV source (hmvmania.com).
//
// VERIFIED from sandbox (2026-11, keyless):
//  - Listing: https://hmvmania.com/2d-videos/ (and /2d-videos/page/{N}/ —
//    verified page 2 returns 200 with ~80 video cards). Cards carry
//    <a href="https://hmvmania.com/video/{slug}/"> + lazy <img data-src=…>.
//  - Search: https://hmvmania.com/?s={q} → same video cards (WP site search).
//  - Video page /video/{slug}/: <h1> title, WP video playlist li with
//    data-video-source="https://hmvmania.com/wp-content/uploads/....mp4"
//    (direct MP4 on the site's own hosting), poster/cover image nearby,
//    HMV maker at /author/{name}/.
//  - Direct stream verified: the data-video-source MP4 is the site's own
//    upload — no DRM, no third-party re-host, nothing bypassed.
//
// User directive: HMV = HMVmania + Iwara ONLY. HMVmania is the dedicated HMV
// community site (WordPress + VideoTube theme), 2D videos section.

import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";
import { liveTextResilient, matchAll, match1, htmlDecode, stripHtmlToText } from "./http";

const BASE = "https://hmvmania.com";

/** Parse listing/search HTML into video cards. */
function parseCards(html: string): LiveSearchItem[] {
  const out: LiveSearchItem[] = [];
  const seen = new Set<string>();
  // Each card: anchor to /video/{slug}/ followed (within the card) by a lazy img.
  const chunks = html.split("video-item-card");
  for (const chunk of chunks.slice(1)) {
    const slug = match1(chunk, /href="https:\/\/hmvmania\.com\/video\/([^"#?\/]+)\/?"/);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const thumb = match1(chunk, /data-src="([^" ]+\.(?:jpg|jpeg|png|webp))"/)
      ?? match1(chunk, /src="(https:\/\/hmvmania\.com\/[^" ]+\.(?:jpg|jpeg|png|webp))"/);
    const title = match1(chunk, /<h5>([\s\S]*?)<\/h5>/)
      ?? match1(chunk, /alt="([^"]{3,})"/);
    const maker = match1(chunk, /href="https:\/\/hmvmania\.com\/author\/([^"\/]+)\/"/);
    out.push({
      externalId: slug,
      title: title ? htmlDecode(title).replace(/\s+/g, " ").trim() : htmlDecode(slug).replace(/[-_]/g, " "),
      coverUrl: thumb ?? null,
      category: "AV",
      videoKind: "HMV",
      format: "HMV",
      creator: maker ? htmlDecode(maker.replace(/[-_]/g, " ")) : null,
      externalUrl: `${BASE}/video/${slug}/`,
      episodesCount: 1,
      extra: { source: "hmvmania" },
    });
  }
  return out;
}

async function fetchListing(url: string): Promise<LiveSearchItem[]> {
  const html = await liveTextResilient(url, { timeoutMs: 20_000, referer: BASE });
  if (!html.includes("video-item-card")) {
    throw new Error("hmvmania: page did not contain any video cards");
  }
  return parseCards(html);
}

function prettifyTitle(raw: string): string {
  return htmlDecode(raw).replace(/\s+/g, " ").trim();
}

export const hmvmaniaAdapter: LiveAdapter = {
  id: "hmvmania",
  integration:
    "HMVmania public listings and pages — the dedicated HMV community site. Video cards from the 2D videos index (paged) with per-video pages exposing the site's own hosted MP4 (data-video-source) played directly. The site's WordPress search does not index video posts, so text search is honestly absent. Nothing is re-hosted and no DRM is touched.",

  async ping() {
    const items = await fetchListing(`${BASE}/2d-videos/`);
    if (!items.length) throw new Error("hmvmania: listing parsed empty");
  },

  async search() {
    // VERIFIED (2026-11): HMVmania's WordPress search does NOT index video
    // posts (?s=otome, ?s=shamsiel → zero video cards; only sidebar comment
    // widgets mention them). Text search is honestly unavailable — browse
    // the 2D videos index instead.
    throw new Error("HMVmania's site search does not cover video posts upstream — browse the 2D videos index instead");
  },

  async popular(opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const url = page <= 1 ? `${BASE}/2d-videos/` : `${BASE}/2d-videos/page/${page}/`;
    return fetchListing(url);
  },

  async details(externalId) {
    const slug = encodeURIComponent(externalId);
    const html = await liveTextResilient(`${BASE}/video/${slug}/`, { timeoutMs: 20_000, referer: BASE });
    const title = prettifyTitle(match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/) ?? externalId);
    if (!html.includes("data-video-source") && !title) {
      throw new Error(`hmvmania: video page for ${externalId} looked empty`);
    }
    const video = match1(html, /data-video-source="([^"]+\.mp4[^"]*)"/);
    const poster =
      match1(html, /data-poster-source="([^"]+)"/) ??
      match1(html, /og:image" content="([^"]+)"/) ??
      match1(html, /(https:\/\/hmvmania\.com\/wp-content\/uploads\/[^\s"']+cover\.jpg)/);
    const maker =
      match1(html, /href="https:\/\/hmvmania\.com\/author\/([^"\/]+)\/"/) ?? null;
    const descRaw = match1(html, /property="og:description" content="([^"]*)"/);
    return {
      externalId,
      title: title || externalId,
      description: descRaw ? stripHtmlToText(htmlDecode(descRaw)) : null,
      coverUrl: poster ?? null,
      bannerUrl: poster ?? null,
      category: "AV",
      videoKind: "HMV",
      format: "HMV",
      creator: maker ? htmlDecode(maker.replace(/[-_]/g, " ")) : null,
      externalUrl: `${BASE}/video/${slug}/`,
      episodesCount: 1,
      extra: {
        source: "hmvmania",
        directMp4: video ? true : false,
      },
    } satisfies LiveSearchItem;
  },

  async units(externalId): Promise<LiveUnits> {
    const html = await liveTextResilient(`${BASE}/video/${encodeURIComponent(externalId)}/`, {
      timeoutMs: 20_000,
      referer: BASE,
    });
    // playlist <li> entries — take every data-video-source (some posts bundle
    // multiple quality variants; the first is the primary stream).
    const sources = matchAll(html, /data-video-source="([^"]+\.mp4[^"]*)"/);
    const poster =
      match1(html, /data-poster-source="([^"]+)"/) ??
      match1(html, /(https:\/\/hmvmania\.com\/wp-content\/uploads\/[^\s"']+cover\.jpg)/) ??
      match1(html, /og:image" content="([^"]+)"/);
    if (!sources.length) throw new Error(`hmvmania: no direct MP4 found on ${externalId}`);
    const primary = htmlDecode(sources[0]);
    return {
      episodes: [
        {
          number: 1,
          title: prettifyTitle(match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/) ?? externalId),
          streamUrl: primary,
          streamType: "video/mp4",
          thumbnailUrl: poster ?? null,
        },
      ],
    };
  },
};
