import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api-utils";
import { cached, TTL } from "@/lib/cache";
import { discoverCategory, listProviders } from "@/lib/providers/engine";

// Metadata database browser — LIVE data only:
//   type=databases → the live Wotaku database directory (real entries, URLs)
//   type=stats     → provider counts + health (the only "catalog" Yozora owns:
//                    the list of extensions the user installed)
export async function GET(req: NextRequest) {
  return handle(async () => {
    const type = req.nextUrl.searchParams.get("type") ?? "databases";
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

    if (type === "databases") {
      const discovery = await cached("databases", "wotaku-databases", TTL.LISTINGS, () => discoverCategory("DATABASE")).catch(() => null);
      const items = discovery?.rails.flatMap((r) => r.items) ?? [];
      return NextResponse.json({
        databases: items.filter(
          (d) => !q || d.title.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q),
        ),
      });
    }

    if (type === "stats") {
      const { installed } = await listProviders();
      const byCategory = new Map<string, number>();
      for (const p of installed) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1);
      return NextResponse.json({
        byCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
        totals: { providers: installed.length, healthy: installed.filter((p) => p.status === "ACTIVE").length, degraded: installed.filter((p) => p.status === "ERROR").length },
        providersHealth: installed
          .map((p) => ({ id: p.id, name: p.name, category: p.category, status: p.status, lastCheckedAt: p.lastCheckedAt, lastError: p.lastError }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  });
}
