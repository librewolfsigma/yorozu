import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { BROWSER_UA, isAllowedMediaUrl, refererFor, curlFallbackFor, liveFetchErrorStatus } from "@/lib/imgproxy";
import { EH_PAGE_RE, ehResolveImage } from "@/lib/providers/live/manga";

// Media proxy for integrated providers only (strict allowlist).
// Streams images (and public mp4/hls clips) with the headers upstreams expect.
//  - E-Hentai viewer pages are resolved on demand (H@H keystamps expire).
//  - ddos-guard protected hosts (e.g. rule34video get_file) need the site's
//    public cookies — we maintain a small per-host cookie jar bootstrapped
//    from a normal public page visit, exactly like a browser would. When the
//    fetch path is TLS-fingerprint-challenged, the same public request is
//    retried through the system curl binary (streamed, Range supported).
// This mirrors what Mihon/Aniyomi do client-side: fetch a publicly served
// resource and display it — no auth, DRM or paywall is ever bypassed.

export const dynamic = "force-dynamic";

interface JarEntry { cookies: string; at: number }
const jar = new Map<string, JarEntry>();
const JAR_TTL = 25 * 60 * 1000;

async function bootstrapCookies(host: string, force = false): Promise<string> {
  const entry = jar.get(host);
  if (!force && entry && Date.now() - entry.at < JAR_TTL) return entry.cookies;
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

async function tryFetch(raw: string, range: string | null, cookies: string): Promise<Response> {
  return fetch(raw, {
    headers: {
      "User-Agent": BROWSER_UA,
      ...(refererFor(raw) ? { Referer: refererFor(raw)! } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
      ...(range ? { Range: range } : {}),
      Accept: "*/*",
    },
    redirect: "follow",
  });
}

/** Fetch this host's homepage via curl and return its Set-Cookie header values. */
function curlBootstrapCookies(host: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("curl", ["-sS", "-L", "-D", "-", "-o", "/dev/null", "-m", "20", "-A", BROWSER_UA, `https://${host}/`], {
      timeout: 22_000,
    });
    let out = "";
    child.stdout.on("data", (c: Buffer) => { out += c.toString(); });
    child.on("close", () => {
      const cookies = [...out.matchAll(/^set-cookie:\s*([^;\r\n]+)/gim)]
        .map((m) => m[1].trim())
        .filter(Boolean)
        .join("; ");
      if (cookies) jar.set(host, { cookies, at: Date.now() });
      resolve(cookies);
    });
    child.on("error", () => resolve(""));
  });
}

/**
 * Curl streaming transport — used when ddos-guard challenges the runtime TLS
 * fingerprint. Spawns the system curl with identical headers and pipes the
 * public resource straight through, Range included. A first-byte sniff
 * rejects tiny HTML challenge pages (they are not the media we asked for);
 * on a challenge we refresh the cookie jar through curl itself and retry once.
 */
function curlStream(raw: string, range: string | null, cookies: string, retried = false): Promise<NextResponse> {
  return new Promise((resolve) => {
    const args = ["-sS", "-L", "--no-buffer", "-m", "120"];
    if (range) args.push("--range", range);
    args.push("-A", BROWSER_UA);
    const ref = refererFor(raw);
    if (ref) args.push("-e", ref);
    if (cookies) args.push("-H", `Cookie: ${cookies}`);
    args.push("-H", "Accept: */*");
    args.push(raw);

    const child = spawn("curl", args);
    let ok = false;
    let head = Buffer.alloc(0);
    let done = false;

    const fail = (msg: string, status = 502) => {
      if (done) return;
      done = true;
      try { child.kill("SIGKILL"); } catch { /* already exited */ }
      resolve(new NextResponse(msg, { status }));
    };

    child.stdout.on("data", (chunk: Buffer) => {
      if (done) return;
      if (!ok) {
        head = Buffer.concat([head, chunk]);
        // MP4/TS/webm/mkv never start with '<' — a challenge page does.
        if (head.length >= 16 || head[0] === 0x3c /* '<' */) {
          if (head[0] === 0x3c) {
            try { child.kill("SIGKILL"); } catch { /* already exited */ }
            done = true;
            if (retried) {
              resolve(new NextResponse("Upstream bot challenge (curl path)", { status: 403 }));
              return;
            }
            // ddos-guard rotated its cookies — mint a fresh jar through curl
            // itself, then retry the same public request once.
            const host = new URL(raw).hostname;
            void curlBootstrapCookies(host).then((fresh) => curlStream(raw, range, fresh, true)).then(resolve);
            return;
          }
          ok = true;
          const headers = new Headers();
          headers.set("Content-Type", "video/mp4");
          headers.set("Cache-Control", "no-store");
          headers.set("Accept-Ranges", "bytes");
          if (range) headers.set("Content-Range", range.replace(/^bytes=(\d+)-(\d*)$/, (_m, s, e) => `bytes ${s}-${e || "*"}`));
          const body = new ReadableStream({
            start(ctrl) {
              ctrl.enqueue(head);
              child.stdout.on("data", (c: Buffer) => ctrl.enqueue(c));
              child.stdout.on("end", () => {
                try { ctrl.close(); } catch { /* already closed */ }
              });
            },
            cancel() { try { child.kill("SIGKILL"); } catch { /* already exited */ } },
          });
          done = true;
          resolve(new NextResponse(body, { status: range ? 206 : 200, headers }));
        }
      }
    });
    child.on("error", (e) => fail(`curl spawn failed: ${e.message}`));
    child.on("close", (code) => {
      if (!done) {
        if (ok) { done = true; resolve(new NextResponse("stream ended early", { status: 502 })); }
        else fail(`curl exited ${code} before media data`, 502);
      }
    });
  });
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
  const range = req.headers.get("range");

  // 1) normal path — cookie-jar'd fetch
  let cookies = await bootstrapCookies(host);
  let upstream = await tryFetch(raw, range, cookies);

  // 2) ddos-guard rotates challenges — force a fresh jar and retry once
  if (!upstream.ok && upstream.status !== 206 && (upstream.status === 403 || upstream.status === 503)) {
    jar.delete(host);
    cookies = await bootstrapCookies(host, true);
    upstream = await tryFetch(raw, range, cookies);
  }

  // 3) TLS-fingerprint challenge persists → curl streaming transport
  if (!upstream.ok && upstream.status !== 206 && curlFallbackFor(raw)) {
    try { upstream.body?.cancel(); } catch { /* already consumed */ }
    return curlStream(raw, range, cookies, false);
  }

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
  headers.set("Cache-Control", ct?.startsWith("video/") || ct?.includes("mpegurl") ? "no-store" : "public, max-age=86400");
  headers.set("Accept-Ranges", "bytes");

  return new NextResponse(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers,
  });
}
