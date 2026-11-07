import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api-utils";
import { listRepoInfo, syncExtensionRepoAndRefresh, DEFAULT_EXTENSION_REPO_ID } from "@/lib/providers/ext/repo";

// Extension repository management — list sync health, force a re-sync.
// The manifest is data fetched from the upstream repo; a failed sync keeps
// the last-good providers working and records the error for the UI.

export async function GET() {
  return handle(async () => NextResponse.json({ repos: await listRepoInfo() }));
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as { id?: string; url?: string };
    // An https URL override lets a user point Yozora at their own extension repo.
    const urlOverride = body.url && /^https:\/\/\S+$/.test(body.url) ? body.url : undefined;
    const result = await syncExtensionRepoAndRefresh(body.id ?? DEFAULT_EXTENSION_REPO_ID, urlOverride);
    return NextResponse.json({ result, repos: await listRepoInfo() });
  });
}
