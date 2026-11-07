// Shared HTTP layer for live provider adapters.
// - Descriptive User-Agent (required by several public APIs, e.g. e621)
// - Hard timeouts + bounded retries with backoff
// - Small in-memory TTL cache so browse rails don't hammer upstreams
// - Bounded response size for HTML responses

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
export const PLATFORM_UA =
  "YozoraPlatform/1.0 (media aggregator; +https://github.com/librewolfsigma/yozora)";

interface CacheEntry {
  at: number;
  value: unknown;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 min
const CACHE_MAX = 600;

export function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

export class LiveFetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface LiveFetchOpts {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  ua?: string;
  timeoutMs?: number;
  retries?: number;
  cacheTtlMs?: number | null; // null = no cache
  cacheKey?: string | null;
}

export async function liveFetch(
  url: string,
  opts: LiveFetchOpts = {},
): Promise<Response> {
  const {
    method = "GET",
    headers = {},
    body,
    ua = BROWSER_UA,
    timeoutMs = 15_000,
    retries = 1,
    cacheTtlMs = CACHE_TTL_MS,
    cacheKey = null,
  } = opts;

  const key = cacheKey ?? `${method} ${url} ${body ?? ""}`;
  if (cacheTtlMs && method === "GET") {
    const hit = cacheGet<Response>(key);
    if (hit) return hit.clone();
  }

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { "User-Agent": ua, ...headers },
        body,
        signal: ctrl.signal,
        redirect: "follow",
      });
      clearTimeout(timer);
      if (!res.ok) {
        // Retry once on transient upstream failures only.
        if ((res.status === 503 || res.status === 429) && attempt < retries) {
          await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
          continue;
        }
        throw new LiveFetchError(res.status, `Upstream ${res.status} for ${new URL(url).host}`);
      }
      // Reject oversized payloads early when the upstream declares its size —
      // bounded readers below catch the undeclared case while consuming.
      const declared = Number(res.headers.get("content-length") ?? "0");
      if (declared > MAX_RESPONSE_BYTES) {
        try { res.body?.cancel(); } catch { /* no body */ }
        throw new LiveFetchError(502, `Upstream response too large (${Math.round(declared / 1024)} KB declared) for ${new URL(url).host}`);
      }
      if (cacheTtlMs && method === "GET") cacheSet(key, res.clone());
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
        continue;
      }
    }
  }
  if (lastErr instanceof LiveFetchError) throw lastErr;
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new LiveFetchError(502, `Upstream unreachable: ${msg}`);
}

// Metadata payloads only ever need to be small; a runaway upstream (or a
// misbehaving mirror) must not be able to exhaust memory. Cap total bytes
// consumed per response.
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024; // 8 MB

async function boundedText(res: Response, maxBytes = MAX_RESPONSE_BYTES): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* already closed */ }
      throw new LiveFetchError(502, `Upstream response exceeded ${Math.round(maxBytes / 1024)} KB cap`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(out);
}

export async function liveJson<T>(url: string, opts: LiveFetchOpts = {}): Promise<T> {
  const res = await liveFetch(url, { ...opts, headers: { Accept: "application/json", ...(opts.headers ?? {}) } });
  const text = await boundedText(res, 4 * 1024 * 1024); // JSON APIs stay well under this
  return JSON.parse(text) as T;
}

/** Bounded JSON parse for adapters that manage their own fetch calls. */
export async function boundedJson<T>(res: Response, maxBytes = 4 * 1024 * 1024): Promise<T> {
  const text = await boundedText(res, maxBytes);
  return JSON.parse(text) as T;
}

export async function liveText(url: string, opts: LiveFetchOpts = {}): Promise<string> {
  const res = await liveFetch(url, opts);
  return await boundedText(res);
}

export async function livePostJson<T>(url: string, payload: unknown, opts: LiveFetchOpts = {}): Promise<T> {
  const res = await liveFetch(url, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as T;
}

// ─── curl transport ───
// Some public APIs (e.g. e621, ddos-guard tube sites) fingerprint the HTTP
// client's TLS handshake and reject server-side runtimes (Node/Bun) while
// accepting standard clients. For those providers we issue the same real
// request through the system curl binary — same URL, same UA, same data.
import { execFile } from "node:child_process";

export function curlTextAdv(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<string> {
  const { headers = {}, timeoutMs = 20_000 } = opts;
  const args = ["-sS", "-L", "-m", String(Math.ceil(timeoutMs / 1000))];
  for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
  args.push(url);
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      args,
      { maxBuffer: 24 * 1024 * 1024, timeout: timeoutMs + 3000 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new LiveFetchError(502, `curl transport failed: ${(stderr || err.message).slice(0, 160)}`));
          return;
        }
        resolve(stdout as string);
      },
    );
  });
}

/**
 * liveText with automatic curl fallback — resilient page fetch for hosts
 * that intermittently serve 403/503 TLS-fingerprint challenges to server
 * runtimes. The same real request is retried through the system curl with
 * identical headers; challenge-sized bot pages are rejected, not parsed.
 */
export async function liveTextResilient(
  url: string,
  opts: LiveFetchOpts & { referer?: string } = {},
): Promise<string> {
  try {
    return await liveText(url, opts);
  } catch (e) {
    const status = e instanceof LiveFetchError ? e.status : 502;
    if (status !== 403 && status !== 503 && status !== 429) throw e;
    const headers: Record<string, string> = {
      "User-Agent": opts.ua ?? BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (opts.referer) headers.Referer = opts.referer;
    const text = await curlTextAdv(url, { headers, timeoutMs: opts.timeoutMs ?? 20_000 });
    // A bot challenge page is small HTML — never hand one to a parser.
    if (text.length < 1500 && /ddos-guard|challenge|just a moment|attention required/i.test(text)) {
      throw e;
    }
    return text;
  }
}

export async function curlJson<T>(url: string, opts: { ua?: string; timeoutMs?: number } = {}): Promise<T> {
  const text = await curlText(url, opts);
  return JSON.parse(text) as T;
}

export function curlText(
  url: string,
  opts: { ua?: string; timeoutMs?: number } = {},
): Promise<string> {
  const { ua = PLATFORM_UA, timeoutMs = 12_000 } = opts;
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      ["-sS", "--fail", "-m", String(Math.ceil(timeoutMs / 1000)), "-A", ua, "-H", "Accept: application/json", url],
      { maxBuffer: 12 * 1024 * 1024, timeout: timeoutMs + 2000 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new LiveFetchError(502, `curl transport failed: ${(stderr || err.message).slice(0, 160)}`));
          return;
        }
        resolve(stdout as string);
      },
    );
  });
}

// ─── HTML helpers (regex-based, dependency-free) ───

export function htmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function stripTags(s: string): string {
  return htmlDecode(s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

/** First regex match with capture group, or null. */
export function match1(s: string, re: RegExp): string | null {
  const m = s.match(re);
  return m ? m[1] : null;
}

/** All non-overlapping matches of a capture group. */
export function matchAll(s: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))) {
    if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

export function stripHtmlToText(html: string, max = 1200): string {
  return stripTags(html).slice(0, max);
}
