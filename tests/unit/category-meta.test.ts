import { describe, expect, test } from "bun:test";
import { CATEGORIES, VIDEO_KINDS, isReaderCategory } from "@/lib/category-meta";
import { PROVIDER_VIDEO_KIND } from "@/lib/providers/engine";

describe("taxonomy invariants (user-corrected)", () => {
  test("manga, doujin and manhwa are DISTINCT reader categories", () => {
    for (const k of ["MANGA", "DOUJIN", "MANHWA"]) {
      expect(isReaderCategory(k)).toBe(true);
    }
    expect(isReaderCategory("ANIME")).toBe(false);
    expect(isReaderCategory("AV")).toBe(false);
    const keys = CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length); // no duplicate labels/keys
  });

  test("illustrations and collections are distinct categories", () => {
    const keys = CATEGORIES.map((c) => c.key);
    expect(keys).toContain("ILLUSTRATION");
    expect(keys).toContain("GALLERY");
  });

  test("video subcategories never merge into anime", () => {
    const kinds = VIDEO_KINDS.map((k) => k.key);
    expect(kinds).not.toContain("ANIME");
    for (const required of ["JAV", "WESTERN", "CREATOR", "PMV", "HMV", "HENTAI"]) {
      expect(kinds).toContain(required);
    }
  });

  test("USER DIRECTIVE: PMV = PMVHaven only; HMV = HMVmania + Iwara only", () => {
    const pmv = Object.entries(PROVIDER_VIDEO_KIND).filter(([, k]) => k === "PMV").map(([id]) => id);
    const hmv = Object.entries(PROVIDER_VIDEO_KIND).filter(([, k]) => k === "HMV").map(([id]) => id);
    expect(pmv).toEqual(["pmvhaven"]);
    expect(hmv.sort()).toEqual(["hmvmania", "iwara"]);
  });

  test("USER DIRECTIVE: anidb removed (anime must stream)", () => {
    expect(Object.keys(PROVIDER_VIDEO_KIND)).not.toContain("anidb");
  });
});
