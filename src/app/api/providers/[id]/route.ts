import { NextRequest, NextResponse } from "next/server";
import { handle, ApiError } from "@/lib/api-utils";
import { searchCatalog } from "@/lib/providers/engine";

// Provider catalog browsing (Mihon-style "source" pages).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const result = await searchCatalog(id, {
      q: sp.get("q") ?? undefined,
      page: sp.get("page") ? parseInt(sp.get("page")!, 10) : 1,
      pageSize: sp.get("pageSize") ? parseInt(sp.get("pageSize")!, 10) : 24,
    });
    return NextResponse.json(result);
  });
}

export function POST() {
  throw new ApiError(405, "Use /api/providers with an action body.");
}
