import { NextRequest, NextResponse } from "next/server";
import { handle, ApiError } from "@/lib/api-utils";
import { resolvePages } from "@/lib/providers/engine";

// Lazy chapter/gallery page resolution — the reader's data source.
// Replaces the old DB-backed /api/chapters/[id]: pages resolve live through
// the provider adapter and live only in the short TTL cache (MangaDex at-home
// URLs expire ~15 min, so they must never be persisted).
export async function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams;
    const provider = sp.get("p");
    const url = sp.get("url");
    if (!provider || !url) throw new ApiError(400, "p (provider) and url (chapter token) are required");
    const pages = await resolvePages(provider, url);
    return NextResponse.json({ pages });
  });
}
