"use client";

// Category metadata: labels, icons, hub accents (Hikari per-section accent system)
import {
  Tv, BookOpen, Heart, ScrollText, Image as ImageIcon, Images, Video, Gamepad2,
  FileCode2, Database, Compass, type LucideIcon,
} from "lucide-react";

export interface CategoryMeta {
  key: string;
  label: string;
  icon: LucideIcon;
  hub: string; // accent color
  hub2: string;
  action: string; // primary CTA label
  unit: string; // "episode" / "chapter" / …
}

export const CATEGORIES: CategoryMeta[] = [
  { key: "ANIME", label: "Anime", icon: Tv, hub: "var(--primary)", hub2: "#4648B8", action: "Watch now", unit: "episode" },
  { key: "MANGA", label: "Manga", icon: BookOpen, hub: "#3ED6B0", hub2: "#1A9C8E", action: "Read now", unit: "chapter" },
  { key: "DOUJIN", label: "Doujin", icon: Heart, hub: "#FF8AC2", hub2: "#E0559B", action: "Read now", unit: "chapter" },
  { key: "MANHWA", label: "Manhwa", icon: ScrollText, hub: "#FFBE4A", hub2: "#EE8424", action: "Read now", unit: "chapter" },
  { key: "ILLUSTRATION", label: "Images (Booru)", icon: ImageIcon, hub: "#AE8BFF", hub2: "#7556F0", action: "View image", unit: "image" },
  { key: "GALLERY", label: "Image Collections", icon: Images, hub: "#8AE0B0", hub2: "#2FA86B", action: "Open collection", unit: "image" },
  { key: "AV", label: "AV", icon: Video, hub: "#FF6F91", hub2: "#E3436A", action: "Play", unit: "scene" },
  { key: "GAME", label: "Games", icon: Gamepad2, hub: "#FF8A4C", hub2: "#E5582C", action: "Install", unit: "file" },
  { key: "SCRIPT", label: "Scripts", icon: FileCode2, hub: "#3BD47A", hub2: "#1E9E57", action: "Install", unit: "script" },
  { key: "DATABASE", label: "Databases", icon: Database, hub: "#6BC5D2", hub2: "#2E8C9A", action: "Open", unit: "resource" },
  { key: "MISC", label: "Miscellaneous", icon: Compass, hub: "#A48BFF", hub2: "#7556F0", action: "Open", unit: "resource" },
];

export function categoryMeta(key: string): CategoryMeta {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES.find((c) => c.key === "MISC")!;
}

/**
 * Taxonomy (user-corrected): Manga, Doujin and Manhwa are THREE DISTINCT
 * categories. Doujinshi (self-published galleries — E-Hentai, WholesomeList,
 * Sukebei) is never merged into serialized Manga (MangaDex, MangaUpdates).
 * Single booru images (ILLUSTRATION) are distinct from curated multi-image
 * collections (GALLERY) and render with a completely different UI.
 */
export function isReaderCategory(key: string): boolean {
  return key === "MANGA" || key === "DOUJIN" || key === "MANHWA";
}

// AV subcategories. TAXONOMY (user-corrected): AV and JAV are THE SAME
// category — "AV" IS Japanese Adult Video. The distinct slices that remain:
// western studio scenes, creator/indie clips, PMV/HMV edits, hentai animation.
export const VIDEO_KINDS_DOC = "AV and JAV are THE SAME category — Japanese Adult Video. Distinct slices: WESTERN, CREATOR, PMV, HMV, HENTAI.";

export const VIDEO_KINDS: { key: string; label: string; blurb: string }[] = [
  { key: "", label: "All video", blurb: "Every adult-video subcategory" },
  { key: "JAV", label: "AV · JAV", blurb: "Japanese adult video — the AV category itself (JavDB, r18.dev, XVideos, JAVStash)" },
  { key: "WESTERN", label: "Western scenes", blurb: "Studio scene metadata (StashDB — optional free API key)" },
  { key: "CREATOR", label: "Creator", blurb: "Independent & clip-store creators (FansDB)" },
  { key: "PMV", label: "PMV", blurb: "Porn music video edits — PMVHaven exclusively (user directive)" },
  { key: "HMV", label: "HMV", blurb: "Hentai music video edits — HMVmania + Iwara only (user directive)" },
  { key: "HENTAI", label: "Hentai & animated", blurb: "Adult animation / CG clips (Rule34Video, Hanime1)" },
];

export function videoKindLabel(kind: string | null | undefined): string {
  if (!kind) return "AV";
  return VIDEO_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

export const LIBRARY_STATUSES = [
  { key: "PLANNING", label: "Planning" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "PAUSED", label: "Paused" },
  { key: "DROPPED", label: "Dropped" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  HIATUS: "Hiatus",
};

export function fmtDuration(sec?: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtBytes(b: number): string {
  if (b > 1024 * 1024 * 1024) return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}

export function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function timeAgo(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}
