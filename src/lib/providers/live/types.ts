// Live adapter contract — every real provider implements this interface.
// Results are normalized into the platform's CatalogItem shape.

export interface LiveSearchItem {
  externalId: string;
  title: string;
  altTitles?: string[];
  description?: string | null;
  coverUrl?: string | null;
  bannerUrl?: string | null;
  category: string; // ANIME | MANGA | MANHWA | ILLUSTRATION | AV | GAME | SCRIPT | MISC
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
  /** Lightweight liveness probe — throws on failure. */
  ping(): Promise<void>;
  /** Catalog search. `q` may be empty for "browse". */
  search(q: string, opts?: SearchOpts): Promise<LiveSearchItem[]>;
  /** Popular/trending listing used for discover rails (no query). */
  popular?(opts?: { page?: number }): Promise<LiveSearchItem[]>;
  /** Full details for one external item. */
  details?(externalId: string): Promise<LiveSearchItem | null>;
  /** Materializable content units (chapters/pages/episodes/images). */
  units?(externalId: string): Promise<LiveUnits | null>;
  /**
   * Lazy chapter resolution: given the stored source URL (a gallery page or a
   * chapter page), return the real image URLs. Cached into ChapterPage rows.
   */
  resolveChapter?(sourceUrl: string): Promise<string[]>;
  /** Human-readable integration description for the extension manager. */
  integration: string;
}
