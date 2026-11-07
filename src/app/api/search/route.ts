import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api-utils";
import { searchProviders } from "@/lib/providers/engine";

// Unified live search — fans out to every usable provider in scope.
// Results are streamed from upstream (TTL-cached in memory) and deduped per
// request on external refs. Nothing is written to any database.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim();
    const category = sp.get("category") ?? undefined;
    const providers = (sp.get("providers") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    if (!q) {
      return NextResponse.json({ q, providerResults: [], groups: {}, providerErrors: [], total: 0 });
    }
    const data = await searchProviders({ q, category, providers: providers.length ? providers : undefined, page });
    return NextResponse.json(data);
  });
}
