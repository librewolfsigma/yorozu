import { NextRequest, NextResponse } from "next/server";
import { handle, ApiError } from "@/lib/api-utils";
import { getProviderDTO, searchOneProvider } from "@/lib/providers/engine";
import type { WorkDTO } from "@/lib/serialize";

// Live source browsing (Mihon-style) — hits the provider upstream per request.
// There is no local catalog; every page comes from the source itself.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const { def, dto, adapter } = await getProviderDTO(id);

    const q = sp.get("q") ?? "";
    let items: WorkDTO[] = [];
    let error: string | null = null;
    if (q.trim()) {
      try {
        items = await searchOneProvider(def, dto, q.trim(), page);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    } else if (adapter?.popular) {
      try {
        const { discoverCategory } = await import("@/lib/providers/engine");
        const disc = await discoverCategory(def.category);
        const rail = disc.rails.find((r) => r.providerId === def.id);
        items = rail?.items ?? [];
        error = rail?.error ?? null;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    } else {
      error = `${def.name} is search-only — enter a query.`;
    }

    return NextResponse.json({
      provider: {
        id: dto.id, name: dto.name, category: dto.category, status: dto.status,
        configRequired: dto.configRequired, availability: dto.availability,
        configSchema: dto.configSchema, config: dto.config, videoKind: dto.videoKind,
      },
      items,
      error,
      total: items.length,
      page,
      live: true,
    });
  });
}

export function POST() {
  throw new ApiError(405, "Use /api/providers with an action body.");
}
