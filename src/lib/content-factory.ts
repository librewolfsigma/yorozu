// Pure content utilities shared across the platform (hashing, title
// normalization, per-category accents). Client-first note: these helpers do
// NOT generate or fabricate any media — artwork/pages/streams always come
// from real provider URLs (docs/CLIENT_ARCHITECTURE.md).

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ 4294967296;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Letter avatar (user avatars only — not media artwork).
export function avatarUrl(seed: string, label: string): string {
  return `/api/placeholder?type=avatar&seed=${encodeURIComponent(seed)}&label=${encodeURIComponent(label)}&w=160&h=160`;
}

// Per-category "hub" accents modeled after Hikari's per-section accent system.
export const CATEGORY_ACCENTS: Record<string, [string, string]> = {
  ANIME: ["#3DB4F2", "#1E97D8"],
  MANGA: ["#3ED6B0", "#1A9C8E"],
  DOUJIN: ["#FF8AC2", "#E0559B"],
  MANHWA: ["#FFBE4A", "#EE8424"],
  ILLUSTRATION: ["#AE8BFF", "#7556F0"],
  GALLERY: ["#8AE0B0", "#2FA86B"],
  AV: ["#FF6F91", "#E3436A"],
  GAME: ["#FF8A4C", "#E5582C"],
  SCRIPT: ["#3BD47A", "#1E9E57"],
  DATABASE: ["#6BC5D2", "#2E8C9A"],
  MISC: ["#A48BFF", "#7556F0"],
};

export function accentFor(category: string, key: string): [string, string] {
  const [a, b] = CATEGORY_ACCENTS[category] ?? ["#3DB4F2", "#1E97D8"];
  const rand = mulberry32(hashString(key));
  const jitter = Math.floor(rand() * 3);
  if (jitter === 0) return [a, b];
  if (jitter === 1) return [b, a];
  return [a, b];
}
