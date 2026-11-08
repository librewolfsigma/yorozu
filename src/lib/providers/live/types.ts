// Live adapter contract — every real provider implements this interface.
// Results are normalized into the platform's live WorkDTO shape (src/lib/serialize).
// Nothing here persists: results flow to the client per request, TTL-cached only.

export interface LiveSearchItem {
  externalId: string;
  title: string;
  altTitles?: string[];
  description?: string | null;
  coverUrl?: string | null;
  bannerUrl?: string | null;
  category: string; // ANIME | MANGA | MANHWA | ILLUSTRATION | AV | GAME | SCRIPT | MISC
  /**
   * Video subcategory for AV-category items — kept DISTINCT by design:
   * AV | JAV | PMV | HMV | CREATOR. Never merged into ANIME.
   */
  videoKind?: string;
  format?: string | null;
  status?: string | null;
  year?: number | null;
  score?: number | null; // 0–10
  popularity?: number;
  genres?: string[];
  tags?: string[];
  studio?: string | null;
  creator?: string | null;
  externalUrl?: string | null;
  extra?: Record<string, unknown>;
  episodesCount?: number | null;
  chaptersCount?: number | null;
  galleryCount?: number | null;
}

export interface LiveChapterUnit {
  number: number;
  title?: string | null;
  /** Image URLs, or page-plan URLs the adapter resolves later (see pageKind). */
  pages: string[];
  pageKind?: "image" | "page-url";
}

export interface LiveUnits {
  episodes?: {
    number: number;
    title?: string | null;
    streamUrl?: string | null;
    streamType?: string | null;
    thumbnailUrl?: string | null;
    durationSec?: number | null;
    summary?: string | null;
  }[];
  chapters?: LiveChapterUnit[];
  images?: { url: string; thumbUrl?: string; width?: number; height?: number; tags?: string[] }[];
}

export interface SearchOpts {
  page?: number;
  tags?: string[];
  /** User-provided provider configuration (e.g. Gelbooru API key). */
  config?: Record<string, string>;
}

/** A provider adapter for a real external source. */
export interface LiveAdapter {
  id: string;
  /** Lightweight liveness probe — throws on failure. Receives the user's
   *  provider config (e.g. API keys) so gated providers can actually probe. */
  ping(config?: Record<string, string>): Promise<void>;
  /** Catalog search. `q` may be empty for "browse". */
  search(q: string, opts?: SearchOpts): Promise<LiveSearchItem[]>;
  /**
   * Popular/trending listing used for discover rails (no query).
   * `kind` carries the AV subcategory the rail is being built for
   * (JAV | PMV | HMV | …) so one multi-content provider can tune its rail.
   */
  popular?(opts?: { page?: number; kind?: string; config?: Record<string, string> }): Promise<LiveSearchItem[]>;
  /** Full details for one external item. */
  details?(externalId: string, opts?: SearchOpts): Promise<LiveSearchItem | null>;
  /** Materializable content units (chapters/pages/episodes/images).
   *  Receives the user's provider config (self-hosted sources need baseUrl). */
  units?(externalId: string, opts?: SearchOpts): Promise<LiveUnits | null>;
  /**
   * Lazy chapter resolution: given the stored source URL (a gallery page or a
   * chapter page), return the real image URLs. Cached into ChapterPage rows.
   */
  resolveChapter?(sourceUrl: string): Promise<string[]>;
  /** Human-readable integration description for the extension manager. */
  integration: string;
}
