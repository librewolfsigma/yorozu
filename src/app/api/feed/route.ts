import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api-utils";
import { feedCategory } from "@/lib/providers/engine";

// Paged live feed for one category — the engine behind infinite scroll.
// Every page is a real upstream fetch (TTL-cached briefly), interleaved
// across all usable providers in scope, deduped on external refs.
// `?kind=` keeps AV subcategories distinct (JAV/PMV/HMV/… — never merged);
// `?q=` turns the feed into a paged in-category search.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams;
    const category = (sp.get("category") ?? "").toUpperCase();
    if (!category) throw new Error("category is required");
    const kind = sp.get("kind") ?? undefined;
    const q = sp.get("q") ?? undefined;
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const data = await feedCategory({ category, kind, q, page });
    return NextResponse.json(data);
  });
}
