import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/api-utils";

// Unified metadata database browser: characters | people | tags | stats.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const type = req.nextUrl.searchParams.get("type") ?? "characters";
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

    if (type === "characters") {
      const rows = await db.character.findMany({
        where: q ? { name: { contains: q } } : {},
        include: { media: { include: { media: { select: { id: true, slug: true, title: true, coverUrl: true, category: true, accent: true } } } } },
        orderBy: { name: "asc" },
        take: 60,
      });
      return NextResponse.json({
        characters: rows.map((c) => ({
          id: c.id, name: c.name, description: c.description, imageUrl: c.imageUrl,
          media: c.media.map((mc) => ({ ...mc.media, role: mc.role })),
        })),
      });
    }

    if (type === "people") {
      const rows = await db.person.findMany({
        where: q ? { name: { contains: q } } : {},
        include: { media: { include: { media: { select: { id: true, slug: true, title: true, coverUrl: true, category: true, accent: true } } } } },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        take: 80,
      });
      return NextResponse.json({
        people: rows.map((p) => ({
          id: p.id, name: p.name, kind: p.kind, bio: p.bio,
          media: p.media.map((mp) => ({ ...mp.media, role: mp.role })),
        })),
      });
    }

    if (type === "tags") {
      const rows = await db.tagDef.findMany({
        where: q ? { name: { contains: q } } : {},
        orderBy: { count: "desc" },
        take: 120,
      });
      return NextResponse.json({ tags: rows });
    }

    if (type === "stats") {
      const byCategory = await db.media.groupBy({ by: ["category"], _count: { _all: true } });
      const [chars, people, tags, providers, chapters, pages, episodes, gallery] = await Promise.all([
        db.character.count(), db.person.count(), db.tagDef.count(),
        db.provider.count({ where: { installed: true } }),
        db.chapter.count(), db.chapterPage.count(), db.episode.count(), db.galleryImage.count(),
      ]);
      const topStudios = await db.media.groupBy({ by: ["studio"], _count: { _all: true }, where: { studio: { not: null } }, orderBy: { _count: { studio: "desc" } }, take: 8 });
      return NextResponse.json({
        byCategory: byCategory.map((c) => ({ category: c.category, count: c._count._all })),
        totals: { characters: chars, people, tags, providers, chapters, pages, episodes, galleryImages: gallery },
        topStudios: topStudios.filter((s) => s.studio).map((s) => ({ name: s.studio as string, count: s._count._all })),
      });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  });
}
