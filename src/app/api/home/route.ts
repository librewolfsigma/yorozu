import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api-utils";
import { serializeMedia } from "@/lib/serialize";
import { discoverCategory, importLightweight } from "@/lib/providers/engine";

// Aggregate payload for the home view — built from LIVE provider data.
// Discovery pulls real "popular" listings from installed providers; the top
// items are materialized into unified Media (lightweight import) so cards
// have real slugs and the hero can use real cover art. No fictional titles.
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();

    const RAIL_CATEGORIES = ["ANIME", "MANGA", "ILLUSTRATION", "MANHWA", "AV", "GAME"];
    const discoveries = await Promise.all(
      RAIL_CATEGORIES.map((c) =>
        discoverCategory(c).catch(() => ({ category: c, rails: [] })),
      ),
    );

    // Materialize the top items of each rail as unified Media (lightweight).
    const categories: Record<string, unknown[]> = {};
    for (const d of discoveries) {
      const merged: { slug: string; providerName: string }[] = [];
      const seen = new Set<string>();
      for (const rail of d.rails) {
        for (const item of rail.items.slice(0, 10)) {
          const key = item.title.toLowerCase().slice(0, 120);
          if (seen.has(key)) continue;
          seen.add(key);
          try {
            const media = await importLightweight(item.id);
            if (media) merged.push({ slug: media.slug, providerName: rail.providerName });
          } catch {
            // one bad row never breaks the rail
          }
        }
      }
      // hydrate DTOs in popularity order
      const slugs = merged.map((m) => m.slug);
      if (slugs.length) {
        const rows = await db.media.findMany({ where: { slug: { in: slugs } }, orderBy: { popularity: "desc" } });
        categories[d.category] = rows.slice(0, 14).map(serializeMedia);
      } else {
        categories[d.category] = [];
      }
    }

    // Hero: prefer items with real banners (AniList) else covers.
    const heroPool = await db.media.findMany({
      where: { OR: [{ bannerUrl: { not: null } }, { coverUrl: { not: null } }] },
      orderBy: { popularity: "desc" },
      take: 8,
    });

    let continue_: unknown[] = [];
    if (user) {
      const rows = await db.progress.findMany({
        where: { userId: user.id, completed: false },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { media: true },
      });
      const seen = new Set<string>();
      continue_ = rows
        .filter((r) => (seen.has(r.mediaId) ? false : (seen.add(r.mediaId), true)))
        .map((r) => ({
          media: serializeMedia(r.media),
          kind: r.kind,
          itemId: r.itemId,
          positionSec: r.positionSec,
          completed: r.completed,
          updatedAt: r.updatedAt,
        }));
    }

    const stats = {
      media: await db.media.count(),
      providers: await db.provider.count({ where: { installed: true } }),
      chapters: await db.chapter.count(),
      episodes: await db.episode.count(),
      galleryImages: await db.galleryImage.count(),
      characters: await db.character.count(),
    };

    return NextResponse.json({
      hero: heroPool.map(serializeMedia),
      popular: heroPool.map(serializeMedia),
      categories,
      continue: continue_,
      stats,
      user: user ? { id: user.id, username: user.username } : null,
    });
  });
}
