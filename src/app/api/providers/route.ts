import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import {
  configureProvider, healthCheck, installProvider, listProviders,
  searchCatalog, toggleProvider, uninstallProvider,
} from "@/lib/providers/engine";

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
        await installProvider(body.providerId);
        return NextResponse.json({ ok: true });
      case "uninstall":
        if (!user) throw new ApiError(401, "Sign in to manage providers.");
        if (!body.providerId) throw new ApiError(400, "providerId required");
        await uninstallProvider(body.providerId);
        return NextResponse.json({ ok: true });
      case "toggle":
        if (!user) throw new ApiError(401, "Sign in to manage providers.");
        if (!body.providerId) throw new ApiError(400, "providerId required");
        await toggleProvider(body.providerId);
        return NextResponse.json({ ok: true });
      case "health":
        if (!body.providerId) throw new ApiError(400, "providerId required");
        return NextResponse.json(await healthCheck(body.providerId));
      case "configure":
        if (!user) throw new ApiError(401, "Sign in to manage providers.");
        if (!body.providerId) throw new ApiError(400, "providerId required");
        await configureProvider(body.providerId, body.config ?? {});
        return NextResponse.json({ ok: true });
      default:
        throw new ApiError(400, "Unknown action");
    }
  });
}
