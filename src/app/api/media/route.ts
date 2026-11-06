import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, ApiError } from "@/lib/api-utils";
import { serializeMedia } from "@/lib/serialize";
import { getCurrentUser } from "@/lib/auth";

const CATEGORIES = ["ANIME", "MANGA", "MANHWA", "ILLUSTRATION", "AV", "GAME", "SCRIPT", "MISC"];

// Unified catalog browse: filters + search + sort + pagination.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams;
    const category = sp.get("category");
    const q = sp.get("q")?.trim();
    const genres = (sp.get("genres") ?? "").split(",").map((g) => g.trim()).filter(Boolean);
    const tags = (sp.get("tags") ?? "").split(",").map((g) => g.trim()).filter(Boolean);
    const status = sp.get("status") ?? undefined;
    const year = sp.get("year") ? parseInt(sp.get("year")!, 10) : undefined;
    const sort = sp.get("sort") ?? "POPULAR";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
    const pageSize = Math.min(60, Math.max(6, parseInt(sp.get("pageSize") ?? "24", 10)));

    if (category && !CATEGORIES.includes(category)) throw new ApiError(400, `Unknown category ${category}`);

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { altTitles: { contains: q } },
        { description: { contains: q } },
        { studio: { contains: q } },
        { creator: { contains: q } },
      ];
    }
    if (genres.length) {
      where.AND = genres.map((g) => ({ genres: { contains: g } }));
    }
    if (tags.length) {
      const tagConds = tags.map((t) => ({ tags: { contains: t } }));
      where.AND = [...(where.AND as unknown[] ?? []), ...tagConds];
    }
    if (status) where.status = status;
    if (year) where.year = year;

    const orderBy =
      sort === "RATING" ? [{ rating: "desc" as const }, { popularity: "desc" as const }] :
      sort === "NEWEST" ? [{ createdAt: "desc" as const }] :
      sort === "TITLE" ? [{ title: "asc" as const }] :
      sort === "YEAR" ? [{ year: "desc" as const }] :
      [{ popularity: "desc" as const }];

    const [rows, total] = await Promise.all([
      db.media.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      db.media.count({ where }),
    ]);

    // per-user library flags for quick UI state
    const user = await getCurrentUser();
    let libraryMap: Record<string, { status: string; favorite: boolean; score: number | null }> = {};
    if (user && rows.length) {
      const entries = await db.libraryEntry.findMany({
        where: { userId: user.id, mediaId: { in: rows.map((r) => r.id) } },
      });
      libraryMap = Object.fromEntries(entries.map((e) => [e.mediaId, { status: e.status, favorite: e.favorite, score: e.score }]));
    }

    // available filter values (for the filter bar) — only on page 1 without heavy filters
    let facets: { genres: { name: string; count: number }[]; years: number[] } | null = null;
    if (page === 1 && !q) {
      const cats = category ? [category] : CATEGORIES;
      const genreRows = await db.media.findMany({
        where: category ? { category } : {},
        select: { genres: true, year: true },
      });
      const genreCount = new Map<string, number>();
      const years = new Set<number>();
      for (const r of genreRows) {
        for (const g of JSON.parse(r.genres) as string[]) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
        if (r.year) years.add(r.year);
      }
      facets = {
        genres: [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([name, count]) => ({ name, count })),
        years: [...years].sort((a, b) => b - a),
      };
    }

    return NextResponse.json({
      items: rows.map(serializeMedia),
      total, page, pageSize, library: libraryMap, facets,
    });
  });
}
