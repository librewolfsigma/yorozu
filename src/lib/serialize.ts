// Client-first DTO serialization — no database entities here.
// Every WorkDTO is built from a LIVE provider result + static registry info.
// See docs/CLIENT_ARCHITECTURE.md for the binding contract.

import { accentFor } from "@/lib/content-factory";

export interface WorkDTO {
  provider: string;
  providerName: string;
  externalId: string;
  ref: string; // "provider:externalId" — dedup/React key
  title: string;
  altTitles: string[];
  description: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  accent: string;
  accent2: string;
  category: string;
  videoKind: string | null; // AV | JAV | PMV | HMV | CREATOR — subcategories never merged
  format: string | null;
  status: string | null;
  year: number | null;
  rating: number | null;
  popularity: number;
  genres: string[];
  tags: string[];
  studio: string | null;
  creator: string | null;
  externalUrl: string | null;
  externalLinks: { label: string; url: string }[];
  /** In-app capability flags derived honestly from what the adapter implements. */
  availability: { watch: boolean; read: boolean; view: boolean };
  extra: Record<string, unknown>;
}

/** Minimal external-ref identity passed to shared UI components. */
export interface WorkRefInfo {
  provider: string;
  externalId: string;
  category: string;
  title: string;
  coverUrl?: string | null;
}

/** Minimal input shape a live adapter search item must expose. */
export interface WorkInput {
  externalId: string;
  title: string;
  altTitles?: string[];
  description?: string | null;
  coverUrl?: string | null;
  bannerUrl?: string | null;
  category: string;
  videoKind?: string;
  format?: string | null;
  status?: string | null;
  year?: number | null;
  score?: number | null;
  popularity?: number;
  genres?: string[];
  tags?: string[];
  studio?: string | null;
  creator?: string | null;
  externalUrl?: string | null;
  extra?: Record<string, unknown>;
}

export function workRef(provider: string, externalId: string): string {
  return `${provider}:${externalId}`;
}

/**
 * Build the public DTO from a live adapter item.
 * `availability` comes from the provider's declared capabilities — the UI
 * must never offer an in-app action the source cannot actually serve.
 */
export function toWorkDTO(
  item: WorkInput,
  provider: { id: string; name: string; canWatch: boolean; canRead: boolean; canView: boolean },
  extraLinks: { label: string; url: string }[] = [],
): WorkDTO {
  const [accent, accent2] = accentFor(item.category, `${provider.id}:${item.externalId}`);
  const externalLinks: { label: string; url: string }[] = [];
  if (item.externalUrl) externalLinks.push({ label: `Open on ${provider.name}`, url: item.externalUrl });
  const magnet = item.extra?.magnet;
  if (typeof magnet === "string") externalLinks.push({ label: "Magnet download (external client)", url: magnet });
  externalLinks.push(...extraLinks);

  return {
    provider: provider.id,
    providerName: provider.name,
    externalId: item.externalId,
    ref: workRef(provider.id, item.externalId),
    title: item.title,
    altTitles: (item.altTitles ?? []).slice(0, 10),
    description: item.description ?? null,
    coverUrl: item.coverUrl ?? null,
    bannerUrl: item.bannerUrl ?? null,
    accent,
    accent2,
    category: item.category,
    videoKind: item.videoKind ?? null,
    format: item.format ?? null,
    status: item.status ?? null,
    year: item.year ?? null,
    rating: item.score ?? null,
    popularity: item.popularity ?? 0,
    genres: item.genres ?? [],
    tags: (item.tags ?? []).slice(0, 40),
    studio: item.studio ?? null,
    creator: item.creator ?? null,
    externalUrl: item.externalUrl ?? null,
    externalLinks,
    availability: {
      watch: provider.canWatch,
      read: provider.canRead,
      view: provider.canView,
    },
    extra: item.extra ?? {},
  };
}

/** Dedupe a list of DTOs on the external ref (request-time dedup — no local index). */
export function dedupeByRef(items: WorkDTO[]): WorkDTO[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.ref) ? false : (seen.add(i.ref), true)));
}

export function serializeUser(u: {
  id: string; username: string; displayName: string | null;
  bio: string | null; avatarUrl: string | null; isDemo: boolean;
  ageVerifiedAt: Date | null; settings: string; createdAt: Date;
}) {
  return {
    id: u.id, username: u.username, displayName: u.displayName ?? u.username,
    bio: u.bio, avatarUrl: u.avatarUrl, isDemo: u.isDemo,
    ageVerified: !!u.ageVerifiedAt,
    settings: JSON.parse(u.settings || "{}"),
    createdAt: u.createdAt,
  };
}
