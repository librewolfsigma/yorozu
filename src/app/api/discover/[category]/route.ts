import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api-utils";
import { discoverCategory } from "@/lib/providers/engine";

// Live discover rails for one category — real "popular" listings pulled from
// every installed provider in that category. Results are cached as CatalogItem
// rows (deduped by providerId+externalId).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ category: string }> }) {
  return handle(async () => {
    const { category } = await ctx.params;
    const data = await discoverCategory(category.toUpperCase());
    return NextResponse.json(data);
  });
}
