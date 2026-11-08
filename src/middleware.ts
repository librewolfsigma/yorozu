import { NextRequest, NextResponse } from "next/server";

/**
 * Yozora website routing layer.
 *
 * The product served at the preview URL is the Yozora server (seanime fork,
 * Go backend + embedded React UI) running on 127.0.0.1:43211 as a child of
 * the Next.js process. Middleware forwards every product route to it:
 *
 *   - `/` and all SPA routes      → Go server (embedded web UI)
 *   - `/api/v1/**`                → Go server REST API
 *   - `/static`, `/fonts`, `/icons`, `/jassub`, asset files → Go server
 *
 * WebSocket (`/events`) is not proxied here; the UI build carries the
 * gateway XTransformPort parameter so WS connects through the Caddy gateway
 * instead (see fork commit: "web: allow gateway-routed WebSocket").
 */
const GO = "http://127.0.0.1:43211";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Next.js internals and dev assets stay on Next.
  if (pathname.startsWith("/_next")) return NextResponse.next();

  // Legacy Yozora Next.js API routes (maintenance mode) stay on Next.
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/v1")) {
    return NextResponse.next();
  }

  const target = new URL(pathname + search, GO);
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
