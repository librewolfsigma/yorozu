import { NextResponse } from "next/server";
import { ensureSeanimeServer, isSeanimeUp, SEANIME_BASE_URL } from "@/lib/seanime-runtime";

export const dynamic = "force-dynamic";

/**
 * Boots the Yozora (seanime fork) server on demand. The UI/API hit this before
 * the first Go-server request so the preview URL always has a live backend.
 */
export async function GET() {
  const ok = await ensureSeanimeServer();
  return NextResponse.json({
    up: ok,
    probed: await isSeanimeUp(),
    baseUrl: SEANIME_BASE_URL,
  });
}
