import { NextRequest, NextResponse } from "next/server";
import { BROWSER_UA, isAllowedMediaUrl, refererFor, liveFetchErrorStatus } from "@/lib/imgproxy";
import { EH_PAGE_RE, ehResolveImage } from "@/lib/providers/live/manga";

// Media proxy for integrated providers only (strict allowlist).
// Streams images (and public mp4 clips) with the headers upstreams expect.
//  - E-Hentai viewer pages are resolved on demand (H@H keystamps expire).
//  - ddos-guard protected hosts (e.g. rule34video get_file) need the site's
//    public cookies — we maintain a small per-host cookie jar bootstrapped
//    from a normal public page visit, exactly like a browser would.
// This mirrors what Mihon/Aniyomi do client-side: fetch a publicly served
// resource and display it — no auth, DRM or paywall is ever bypassed.

export const dynamic = "force-dynamic";

interface JarEntry { cookies: string; at: number }
const jar = new Map<string, JarEntry>();
const JAR_TTL = 25 * 60 * 1000;

async function bootstrapCookies(host: string): Promise<string> {
  const entry = jar.get(host);
  if (entry && Date.now() - entry.at < JAR_TTL) return entry.cookies;
  try {
    const r0 = await fetch(`https://${host}/`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      redirect: "follow",
    });
    const setCookies = typeof r0.headers.getSetCookie === "function" ? r0.headers.getSetCookie() : [];
    const cookies = setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
    jar.set(host, { cookies, at: Date.now() });
    return cookies;
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return new NextResponse("Missing u", { status: 400 });

  // E-Hentai viewer page → resolve to the real image URL, then redirect.
  if (EH_PAGE_RE.test(raw)) {
    try {
      const img = await ehResolveImage(raw);
      if (!img) return new NextResponse("Could not resolve E-Hentai page", { status: 502 });
      return NextResponse.redirect(new URL(`/api/img?u=${encodeURIComponent(img)}`, req.nextUrl), 302);
    } catch (e) {
      const status = liveFetchErrorStatus(e);
      return new NextResponse(`EH resolve failed: ${e instanceof Error ? e.message : e}`, { status });
    }
  }

  if (!isAllowedMediaUrl(raw)) {
    return new NextResponse("Blocked: host not allowlisted for proxying", { status: 403 });
  }

  const host = new URL(raw).hostname;
  const cookies = await bootstrapCookies(host);
  const range = req.headers.get("range");
  const upstream = await fetch(raw, {
    headers: {
      "User-Agent": BROWSER_UA,
      ...(refererFor(raw) ? { Referer: refererFor(raw)! } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
      ...(range ? { Range: range } : {}),
      Accept: "*/*",
    },
    redirect: "follow",
  });

  if (!upstream.ok && upstream.status !== 206) {
    // ddos-guard may have rotated cookies — drop the jar so next try re-bootstraps
    if (upstream.status === 403) jar.delete(host);
    return new NextResponse(`Upstream ${upstream.status}`, { status: upstream.status });
  }

  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("Content-Type", ct);
  const cl = upstream.headers.get("content-length");
  if (cl) headers.set("Content-Length", cl);
  const cr = upstream.headers.get("content-range");
  if (cr) headers.set("Content-Range", cr);
  headers.set("Cache-Control", ct?.startsWith("video/") ? "no-store" : "public, max-age=86400");
  headers.set("Accept-Ranges", "bytes");

  return new NextResponse(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers,
  });
}
