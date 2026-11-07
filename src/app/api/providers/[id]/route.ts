import { NextRequest, NextResponse } from "next/server";
import { handle, ApiError } from "@/lib/api-utils";
import { providerBrowse } from "@/lib/providers/engine";

// Live source browsing (Mihon-style) — hits the provider upstream per request.
// There is no local catalog; every page comes from the source itself.
// Paged for real: page N is a genuine upstream page-N fetch (TTL-cached
// briefly), so source screens scroll infinitely and new upstream items
// surface as sources publish them.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const q = sp.get("q") ?? "";

    const data = await providerBrowse({ id, q, page });

    return NextResponse.json({
      provider: {
        id: data.provider.id, name: data.provider.name, category: data.provider.category,
        status: data.provider.status, configRequired: data.provider.configRequired,
      },
      items: data.items,
      error: data.error,
      hasMore: data.hasMore,
      total: data.items.length,
      page,
      live: true,
    });
  });
}

export function POST() {
  throw new ApiError(405, "Use /api/providers with an action body.");
}
