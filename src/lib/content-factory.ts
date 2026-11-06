// Deterministic content planning shared by the seeder and the provider import
// pipeline. Given a stable key it produces realistic episode/chapter/gallery
// plans so the same content is generated identically everywhere.

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
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ANIME_EP_TITLES = [
  "First Night", "The Promise", "Secret Arrangement", "Midsummer Confession", "Locked Room",
  "After Curfew", "Rain and Whispers", "The Festival", "Truth or Dare", "Hidden Feelings",
  "Crimson Dawn", "Final Embrace", "Second Chance", "Silent Vow", "The Morning After",
  "One More Night", "Parallel Hearts", "Behind the Curtain", "Uninvited Guest", "Last Summer",
];
const SCENE_TITLES = [
  "Opening Scene", "The Meeting", "After Dark", "Morning Light", "The Hotel Room",
  "Backstage Pass", "Late Shift", "Private Session", "Finale", "Behind the Scenes",
];
const CHAPTER_TITLES = [
  "Chapter", "Ep.", "Part", "Act",
];

export interface EpisodePlan {
  number: number;
  title: string;
  durationSec: number;
  summary: string;
}
export interface ChapterPlan {
  number: number;
  title: string;
  pageCount: number;
}
export interface UnitsPlan {
  episodes: EpisodePlan[];
  chapters: ChapterPlan[];
  galleryImages: number;
}

export function planUnits(category: string, key: string, opts: {
  episodes?: number;
  chapters?: number;
  scenes?: number;
  images?: number;
}): UnitsPlan {
  const rand = mulberry32(hashString(key));
  const plan: UnitsPlan = { episodes: [], chapters: [], galleryImages: 0 };

  if (category === "ANIME") {
    const n = opts.episodes ?? 8 + Math.floor(rand() * 8);
    for (let i = 1; i <= n; i++) {
      plan.episodes.push({
        number: i,
        title: ANIME_EP_TITLES[(i - 1) % ANIME_EP_TITLES.length],
        durationSec: category === "ANIME" ? 1380 + Math.floor(rand() * 240) : 0,
        summary: `Episode ${i}. The story deepens as our characters navigate desire, jealousy and intimacy — all depicted between adult (18+) characters.`,
      });
    }
  }

  if (category === "AV") {
    const n = opts.scenes ?? 3 + Math.floor(rand() * 3);
    for (let i = 1; i <= n; i++) {
      plan.episodes.push({
        number: i,
        title: SCENE_TITLES[(i - 1) % SCENE_TITLES.length],
        durationSec: 900 + Math.floor(rand() * 1500),
        summary: `Scene ${i}. Featuring verified adult (18+) performers. Produced under documented consent policies.`,
      });
    }
  }

  if (category === "MANGA" || category === "MANHWA") {
    const n = opts.chapters ?? 8 + Math.floor(rand() * 14);
    const base = rand() < 0.5 ? 1 : Math.floor(rand() * 20) + 1;
    for (let i = 1; i <= n; i++) {
      plan.chapters.push({
        number: +(base + i - 1).toFixed(1),
        title: `${CHAPTER_TITLES[Math.floor(rand() * CHAPTER_TITLES.length)]} ${base + i - 1}`,
        pageCount: 14 + Math.floor(rand() * 10),
      });
    }
  }

  if (category === "ILLUSTRATION") {
    plan.galleryImages = opts.images ?? 12 + Math.floor(rand() * 16);
  }

  return plan;
}

export function pageUrl(seed: string, label: string, w = 800, h = 1200): string {
  return `/api/placeholder?type=page&seed=${encodeURIComponent(seed)}&label=${encodeURIComponent(label)}&w=${w}&h=${h}`;
}

export function coverUrl(seed: string, title: string, accent: string, category: string): string {
  return `/api/placeholder?type=cover&seed=${encodeURIComponent(seed)}&title=${encodeURIComponent(title)}&accent=${encodeURIComponent(accent)}&category=${encodeURIComponent(category)}`;
}

export function bannerUrl(seed: string, title: string, accent: string): string {
  return `/api/placeholder?type=banner&seed=${encodeURIComponent(seed)}&title=${encodeURIComponent(title)}&accent=${encodeURIComponent(accent)}&w=1600&h=640`;
}

export function thumbUrl(seed: string, label: string, accent: string): string {
  return `/api/placeholder?type=thumb&seed=${encodeURIComponent(seed)}&label=${encodeURIComponent(label)}&accent=${encodeURIComponent(accent)}&w=480&h=270`;
}

export function avatarUrl(seed: string, label: string): string {
  return `/api/placeholder?type=avatar&seed=${encodeURIComponent(seed)}&label=${encodeURIComponent(label)}&w=160&h=160`;
}

export function galleryUrl(seed: string, accent: string, w = 900, h = 1300): string {
  return `/api/placeholder?type=gallery&seed=${encodeURIComponent(seed)}&accent=${encodeURIComponent(accent)}&w=${w}&h=${h}`;
}

// Per-category "hub" accents modeled after Hikari's per-section accent system.
export const CATEGORY_ACCENTS: Record<string, [string, string]> = {
  ANIME: ["#3DB4F2", "#1E97D8"],
  MANGA: ["#3ED6B0", "#1A9C8E"],
  MANHWA: ["#FFBE4A", "#EE8424"],
  ILLUSTRATION: ["#AE8BFF", "#7556F0"],
  AV: ["#FF6F91", "#E3436A"],
  GAME: ["#FF8A4C", "#E5582C"],
  SCRIPT: ["#3BD47A", "#1E9E57"],
  MISC: ["#A48BFF", "#7556F0"],
};

export function accentFor(category: string, key: string): [string, string] {
  const [a, b] = CATEGORY_ACCENTS[category] ?? ["#3DB4F2", "#1E97D8"];
  const rand = mulberry32(hashString(key));
  // slight hue-adjacent variation while keeping category identity
  const jitter = Math.floor(rand() * 3);
  if (jitter === 0) return [a, b];
  if (jitter === 1) return [b, a];
  return [a, b];
}
