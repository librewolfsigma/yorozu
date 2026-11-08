import { NextRequest, NextResponse } from "next/server";

/**
 * Yozora website routing layer (Next.js 16 `proxy` convention).
 *
 * The product served at the preview URL is the Yozora server (seanime fork,
 * Go backend + embedded React UI) running on 127.0.0.1:43211 as a detached
 * child of the Next.js process. This proxy forwards every product route to it:
 *
 *   - `/` and all SPA routes      → Go server (embedded web UI)
 *   - `/api/v1/**`                → Go server REST API
 *   - `/static`, `/fonts`, `/icons`, `/jassub`, asset files → Go server
 *
 * Forwarded/origin headers are stripped for Go-bound requests: the Go server
 * applies a passwordless trusted-local security boundary, and the proxy hop
 * is the trust boundary here (the preview origin is additionally allowlisted
 * in the server's config.toml for the gateway-routed WebSocket `/events`).
 *
 * WebSocket (`/events`) is not proxied here; the UI build carries the gateway
 * XTransformPort parameter so WS connects through the Caddy gateway instead
 * (see fork commit: "web: allow gateway-routed WebSocket").
 */
const GO = "http://127.0.0.1:43211";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Next.js internals and dev assets stay on Next.
  if (pathname.startsWith("/_next")) return NextResponse.next();

  // Legacy Yozora Next.js API routes (maintenance mode) stay on Next.
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/v1")) {
    return NextResponse.next();
  }

  const target = new URL(pathname + search, GO);

  // Present the request to the Go server as a local, proxy-hop-terminated
  // request: drop forwarded client metadata and browser origin markers.
  const headers = new Headers(req.headers);
  for (const h of [
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-real-ip",
    "forwarded",
    "origin",
    "referer",
  ]) {
    headers.delete(h);
  }
  headers.set("host", "127.0.0.1:43211");

  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
