import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/api-utils";
import { serializeMedia, serializeCatalogItem } from "@/lib/serialize";
import { getLiveAdapter } from "@/lib/providers/live";
import { upsertLiveItems } from "@/lib/providers/engine";

// Global search: unified database results (imported media) + LIVE provider
// results from installed adapters. Each provider's upstream is queried in
// parallel; a failing provider is reported per-provider without breaking
// the overall search.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!q) return NextResponse.json({ q, groups: {}, providerResults: [], providerErrors: [], total: 0 });

    const rows = await db.media.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { altTitles: { contains: q } },
          { description: { contains: q } },
          { studio: { contains: q } },
          { creator: { contains: q } },
          { tags: { contains: q.toLowerCase() } },
        ],
      },
      orderBy: { popularity: "desc" },
      take: 60,
    });

    const groups: Record<string, unknown[]> = {};
    for (const m of rows) {
      (groups[m.category] ??= []).push(serializeMedia(m));
    }

    // Live search across one primary provider per content category.
    const PRIMARY = ["anilist", "ehentai", "manga18fx", "e621", "rule34video", "javdb", "vndb", "sukebei-anime"];
    const providers = await db.provider.findMany({
      where: { installed: true, status: { not: "DISABLED" }, id: { in: PRIMARY } },
    });

    const settled = await Promise.all(
      providers.map(async (p) => {
        const adapter = getLiveAdapter(p.id);
        if (!adapter) return null;
        try {
          const items = await adapter.search(q, {
            page: 1,
            config: JSON.parse(p.config || "{}"),
          });
          const catalogRows = await upsertLiveItems(p.id, items.slice(0, 12));
          return {
            provider: { id: p.id, name: p.name, installed: p.installed, status: p.status },
            results: catalogRows.map((c) => ({ ...serializeCatalogItem(c), provider: { id: p.id, name: p.name, installed: p.installed, status: p.status } })),
            error: null as string | null,
          };
        } catch (e) {
          return {
            provider: { id: p.id, name: p.name, installed: p.installed, status: p.status },
            results: [],
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    const providerResults = settled.filter((s): s is NonNullable<typeof s> => s !== null);
    return NextResponse.json({
      q,
      groups,
      providerResults: providerResults.flatMap((s) => s.results),
      providerErrors: providerResults.filter((s) => s.error).map((s) => ({ provider: s.provider.name, error: s.error })),
      total: rows.length + providerResults.reduce((n, s) => n + s.results.length, 0),
    });
  });
}
