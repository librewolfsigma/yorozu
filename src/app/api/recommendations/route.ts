import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api-utils";
import { serializeMedia } from "@/lib/serialize";

// Content-based recommendations: shared genres/tags with library entries.
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) {
      const popular = await db.media.findMany({ orderBy: { popularity: "desc" }, take: 12 });
      return NextResponse.json({ reason: "popular", items: popular.map(serializeMedia) });
    }

    const entries = await db.libraryEntry.findMany({
      where: { userId: user.id },
      include: { media: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
    });
    if (!entries.length) {
      const popular = await db.media.findMany({ orderBy: { popularity: "desc" }, take: 12 });
      return NextResponse.json({ reason: "popular", items: popular.map(serializeMedia) });
    }

    const owned = new Set(entries.map((e) => e.mediaId));
    const weights = new Map<string, number>();
    for (const e of entries) {
      for (const g of JSON.parse(e.media.genres) as string[]) weights.set(`g:${g}`, (weights.get(`g:${g}`) ?? 0) + 2);
      for (const t of JSON.parse(e.media.tags) as string[]) weights.set(`t:${t}`, (weights.get(`t:${t}`) ?? 0) + 1);
    }
    const genreConds = [...weights.keys()].filter((k) => k.startsWith("g:")).map((k) => ({ genres: { contains: k.slice(2) } }));
    const candidates = await db.media.findMany({
      where: {
        id: { notIn: [...owned] },
        ...(genreConds.length ? { OR: genreConds } : {}),
      },
      take: 60,
      orderBy: { popularity: "desc" },
    });

    const scored = candidates
      .map((m) => {
        let s = 0;
        for (const g of JSON.parse(m.genres) as string[]) s += weights.get(`g:${g}`) ?? 0;
        for (const t of JSON.parse(m.tags) as string[]) s += weights.get(`t:${t}`) ?? 0;
        return { m, s };
      })
      .sort((a, b) => b.s - a.s || b.m.popularity - a.m.popularity)
      .slice(0, 12);

    const anchor = entries.find((e) => e.score && e.score >= 8)?.media?.title;
    return NextResponse.json({
      reason: anchor ? `Because you enjoyed ${anchor}` : "Based on your library",
      items: scored.map(({ m }) => serializeMedia(m)),
    });
  });
}
