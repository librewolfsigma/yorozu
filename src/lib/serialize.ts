import type { Media } from "@prisma/client";

export interface MediaDTO {
  id: string;
  slug: string;
  title: string;
  altTitles: string[];
  description: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  accent: string | null;
  accent2: string | null;
  category: string;
  format: string | null;
  status: string | null;
  year: number | null;
  rating: number;
  ratingCount: number;
  popularity: number;
  genres: string[];
  tags: string[];
  studio: string | null;
  creator: string | null;
  ageRating: string;
  contentFlags: string[];
  externalLinks: { label: string; url: string }[];
  extra: Record<string, unknown>;
  createdAt: Date;
}

export function serializeMedia(m: Media): MediaDTO {
  return {
    id: m.id, slug: m.slug, title: m.title,
    altTitles: JSON.parse(m.altTitles || "[]"),
    description: m.description,
    coverUrl: m.coverUrl, bannerUrl: m.bannerUrl,
    accent: m.accent, accent2: m.accent2,
    category: m.category, format: m.format, status: m.status, year: m.year,
    rating: m.rating, ratingCount: m.ratingCount, popularity: m.popularity,
    genres: JSON.parse(m.genres || "[]"),
    tags: JSON.parse(m.tags || "[]"),
    studio: m.studio, creator: m.creator,
    ageRating: m.ageRating,
    contentFlags: JSON.parse(m.contentFlags || "[]"),
    externalLinks: JSON.parse(m.externalLinks || "[]"),
    extra: JSON.parse(m.extra || "{}"),
    createdAt: m.createdAt,
  };
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

export function serializeCatalogItem(item: {
  id: string; providerId: string; externalId: string; title: string;
  altTitles: string; description: string | null; coverUrl: string | null;
  bannerUrl: string | null; accent: string | null; category: string;
  format: string | null; status: string | null; year: number | null;
  score: number | null; popularity: number; genres: string; tags: string;
  studio: string | null; creator: string | null; ageRating: string;
  contentFlags: string; externalUrl: string | null; extra: string;
  episodesCount: number | null; chaptersCount: number | null;
  galleryCount: number | null; imported: boolean;
}) {
  return {
    id: item.id, providerId: item.providerId, externalId: item.externalId,
    title: item.title, altTitles: JSON.parse(item.altTitles) as string[],
    description: item.description, coverUrl: item.coverUrl, bannerUrl: item.bannerUrl,
    accent: item.accent, category: item.category, format: item.format,
    status: item.status, year: item.year, score: item.score,
    popularity: item.popularity, genres: JSON.parse(item.genres) as string[],
    tags: JSON.parse(item.tags) as string[], studio: item.studio,
    creator: item.creator, ageRating: item.ageRating,
    contentFlags: JSON.parse(item.contentFlags) as string[],
    externalUrl: item.externalUrl, extra: JSON.parse(item.extra || "{}"),
    episodesCount: item.episodesCount, chaptersCount: item.chaptersCount,
    galleryCount: item.galleryCount, imported: item.imported,
  };
}
