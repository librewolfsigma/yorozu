import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api-utils";
import { serializeMedia } from "@/lib/serialize";

// Aggregate payload for the home view: hero, continue, trending rows, spotlight.
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();

    const hero = await db.media.findMany({
      where: { bannerUrl: { not: null } },
      orderBy: { popularity: "desc" },
      take: 6,
    });

    const popular = await db.media.findMany({
      orderBy: { popularity: "desc" },
      take: 18,
    });

    const categories: Record<string, unknown[]> = {};
    for (const cat of ["ANIME", "MANGA", "MANHWA", "ILLUSTRATION", "AV", "GAME"]) {
      categories[cat] = (
        await db.media.findMany({ where: { category: cat }, orderBy: { popularity: "desc" }, take: 12 })
      ).map(serializeMedia);
    }

    let continue_: unknown[] = [];
    if (user) {
      const rows = await db.progress.findMany({
        where: { userId: user.id, completed: false },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { media: true },
      });
      const recentCompleted = await db.progress.findMany({
        where: { userId: user.id, completed: true },
        orderBy: { updatedAt: "desc" },
        take: 4,
        include: { media: true },
      });
      const seen = new Set<string>();
      continue_ = [...rows, ...recentCompleted]
        .filter((r) => {
          if (seen.has(r.mediaId)) return false;
          seen.add(r.mediaId);
          return true;
        })
        .slice(0, 8)
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
      hero: hero.map(serializeMedia),
      popular: popular.map(serializeMedia),
      categories,
      continue: continue_,
      stats,
      user: user ? { id: user.id, username: user.username } : null,
    });
  });
}
