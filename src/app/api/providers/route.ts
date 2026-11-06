import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import {
  configureProvider, healthCheck, installProvider, listProviders,
  toggleProvider, uninstallProvider,
} from "@/lib/providers/engine";

// Extension manager — the registry is code (src/lib/providers/registry.ts);
// the database only stores the user's install/config/health overlay.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const url = new URL(req.nextUrl);
    if (url.searchParams.get("view") === "repository") {
      const { repository } = await listProviders();
      return NextResponse.json({ repository });
    }
    const data = await listProviders();
    return NextResponse.json(data);
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ action?: string; providerId?: string; config?: Record<string, unknown> }>(req);
    const user = await getCurrentUser();
    switch (body.action) {
      case "install":
        if (!user) throw new ApiError(401, "Sign in to manage providers.");
        if (!body.providerId) throw new ApiError(400, "providerId required");
        return NextResponse.json(await installProvider(body.providerId));
      case "uninstall":
        if (!user) throw new ApiError(401, "Sign in to manage providers.");
        if (!body.providerId) throw new ApiError(400, "providerId required");
        return NextResponse.json(await uninstallProvider(body.providerId));
      case "toggle":
        if (!user) throw new ApiError(401, "Sign in to manage providers.");
        if (!body.providerId) throw new ApiError(400, "providerId required");
        return NextResponse.json(await toggleProvider(body.providerId));
      case "health":
        if (!body.providerId) throw new ApiError(400, "providerId required");
        return NextResponse.json(await healthCheck(body.providerId));
      case "configure":
        if (!user) throw new ApiError(401, "Sign in to manage providers.");
        if (!body.providerId) throw new ApiError(400, "providerId required");
        return NextResponse.json(await configureProvider(body.providerId, body.config ?? {}));
      default:
        throw new ApiError(400, "Unknown action");
    }
  });
}
