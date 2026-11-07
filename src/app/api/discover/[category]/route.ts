import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api-utils";
import { discoverCategory } from "@/lib/providers/engine";

// Live discover rails for one category — real "popular" listings pulled from
// every usable provider in that category. Results live in the TTL cache only.
// `?kind=` filters the AV category into its DISTINCT subcategories
// (AV | JAV | PMV | HMV | CREATOR) — they are never merged.
export async function GET(req: NextRequest, ctx: { params: Promise<{ category: string }> }) {
  return handle(async () => {
    const { category } = await ctx.params;
    const kind = req.nextUrl.searchParams.get("kind") ?? undefined;
    const data = await discoverCategory(category.toUpperCase(), kind);
    return NextResponse.json(data);
  });
}
