import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/api-utils";
import { serializeCatalogItem } from "@/lib/serialize";
import { discoverCategory } from "@/lib/providers/engine";

// Metadata database browser — backed by REAL data:
//  - type=databases: the live Wotaku database directory (real entries, URLs)
//  - type=tags: real tags aggregated from imported provider content
//  - type=stats: real platform statistics (provider health included)
// The old fake characters/people tables (seeded fiction) were removed.

export async function GET(req: NextRequest) {
  return handle(async () => {
    const type = req.nextUrl.searchParams.get("type") ?? "databases";
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

    if (type === "databases") {
      let count = await db.catalogItem.count({ where: { category: "DATABASE" } });
      if (count === 0) {
        await discoverCategory("DATABASE").catch(() => null);
        count = await db.catalogItem.count({ where: { category: "DATABASE" } });
      }
      const rows = await db.catalogItem.findMany({
        where: { category: "DATABASE" },
        include: { provider: { select: { id: true, name: true, status: true, homepage: true } } },
        orderBy: { title: "asc" },
        take: 80,
      });
      return NextResponse.json({
        databases: rows
          .filter((r) => !q || r.title.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q))
          .map((r) => ({
            ...serializeCatalogItem(r),
            provider: { id: r.provider.id, name: r.provider.name, status: r.provider.status },
          })),
      });
    }

    if (type === "tags") {
      // aggregate real tags from imported catalog + unified media
      const media = await db.media.findMany({ select: { tags: true }, take: 2000 });
      const counts = new Map<string, number>();
      for (const m of media) {
        for (const t of JSON.parse(m.tags || "[]") as string[]) {
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
      }
      const tags = [...counts.entries()]
        .filter(([name]) => !q || name.includes(q))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 120)
        .map(([name, count]) => ({ name, count }));
      return NextResponse.json({ tags });
    }

    if (type === "stats") {
      const byCategory = await db.media.groupBy({ by: ["category"], _count: { _all: true } });
      const [providers, chapters, pages, episodes, gallery] = await Promise.all([
        db.provider.count({ where: { installed: true } }),
        db.chapter.count(), db.chapterPage.count(), db.episode.count(), db.galleryImage.count(),
      ]);
      const providersHealth = await db.provider.findMany({
        select: { id: true, name: true, category: true, status: true, lastCheckedAt: true, lastError: true },
        where: { installed: true },
        orderBy: { name: "asc" },
      });
      const topStudios = await db.media.groupBy({ by: ["studio"], _count: { _all: true }, where: { studio: { not: null } }, orderBy: { _count: { studio: "desc" } }, take: 8 });
      return NextResponse.json({
        byCategory: byCategory.map((c) => ({ category: c.category, count: c._count._all })),
        totals: { providers, chapters, pages, episodes, galleryImages: gallery },
        providersHealth,
        topStudios: topStudios.filter((s) => s.studio).map((s) => ({ name: s.studio as string, count: s._count._all })),
      });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  });
}
