// Image/media proxy — routes third-party content through Yozora with correct
// headers so readers/galleries/players work without violating upstream rules.
// Strict host allowlist (SSRF protection). Only hosts belonging to the
// integrated providers are proxied; everything else is rejected.

const ALLOWED_HOSTS = new Set([
  // illustrations
  "e621.net", "static1.e621.net", "yande.re", "hypnohub.net",
  "gelbooru.com", "simg4.gelbooru.com",
  // manga
  "e-hentai.org", "ehgt.org", "ei.e-hentai.org", "ul.ehgt.org",
  "mangadex.org", "uploads.mangadex.org",
  "manga18fx.com", "img01.manga18fx.com", "img02.manga18fx.com", "img03.manga18fx.com",
  "wholesomelist.com", "imgchest.com", "cdni.imgchest.com", "s.imgchest.com",
  // av — tube/metadata sources (CDNs matched by suffix below)
  "rule34video.com", "javdb.com", "c0.jdbstatic.com", "c1.jdbstatic.com",
  "www.xvideos.com", "www.eporner.com", "hanime1.me", "vdownload.hembed.com",
  "pmvhaven.com", "r18.dev",
  // stash-box family (scene covers/CDN assets; scenes themselves never proxied)
  "stashdb.org", "javstash.org", "fansdb.cc", "pmvstash.org",
  // anime
  "s4.anilist.co", "anilistcdn.net",
  // games
  "t.vndb.org", "img.dlsite.jp",
  // torrents thumbnails
  "sukebei.nyaa.si",
]);

// Rotating CDN hosts used by video providers — matched by suffix because the
// exact shard hostnames change constantly (this is the official pattern:
// providers hand out random CDN hostnames per request).
const ALLOWED_HOST_SUFFIXES = [
  ".xvideos-cdn.com", // xvideos mp4/hls/thumb shards (mp4-gcore., hls-gcore., thumb-cdn77.…)
  ".eporner.com", // eporner vid-*.cdn shards
  ".cloud.ovh.net", // PMVHaven's OVH object storage (pmvhavencloud.s3.…io.cloud.ovh.net)
  ".dmm.co.jp", // r18.dev covers (pics.dmm.co.jp) + official trailers (cc3001.dmm.co.jp)
  ".hembed.com", // hanime1.me stream host (vdownload.hembed.com)
  ".jdbstatic.com", // javdb cover shards
];

// H@H CDN client hosts (e-hentai distributed image servers) — matched by
// suffix because client hostnames vary (xxx.dhportvgmptc.hath.network etc.).
export function isHathHost(hostname: string): boolean {
  return hostname.endsWith(".hath.network");
}

// MangaDex at-home image servers — random hostnames *.mangadex.network that
// rotate frequently (official API contract); matched by suffix.
export function isMangaDexNetworkHost(hostname: string): boolean {
  return hostname.endsWith(".mangadex.network");
}

// Referer some hosts require (or expect) — public pages only.
const REFERER_FOR: Record<string, string> = {
  "manga18fx.com": "https://manga18fx.com/",
  "img01.manga18fx.com": "https://manga18fx.com/",
  "img02.manga18fx.com": "https://manga18fx.com/",
  "img03.manga18fx.com": "https://manga18fx.com/",
  "e-hentai.org": "https://e-hentai.org/",
  "ei.e-hentai.org": "https://e-hentai.org/",
  "hypnohub.net": "https://hypnohub.net/",
  "rule34video.com": "https://rule34video.com/",
  "javdb.com": "https://javdb.com/",
  "c0.jdbstatic.com": "https://javdb.com/",
  "c1.jdbstatic.com": "https://javdb.com/",
  "yande.re": "https://yande.re/",
  "e621.net": "https://e621.net/",
  "static1.e621.net": "https://e621.net/",
  "www.xvideos.com": "https://www.xvideos.com/",
  "www.eporner.com": "https://www.eporner.com/",
  "hanime1.me": "https://hanime1.me/",
  "vdownload.hembed.com": "https://hanime1.me/",
  "pmvhaven.com": "https://pmvhaven.com/",
  "r18.dev": "https://r18.dev/",
};

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function isAllowedMediaUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return (
      ALLOWED_HOSTS.has(u.hostname) ||
      ALLOWED_HOST_SUFFIXES.some((s) => u.hostname.endsWith(s)) ||
      isHathHost(u.hostname) ||
      isMangaDexNetworkHost(u.hostname)
    );
  } catch {
    return false;
  }
}

// Hosts whose bot protection intermittently rejects server-side TLS
// fingerprints (ddos-guard). When the plain fetch path fails, /api/img
// retries the same public resource through the system curl binary — the
// same real request a browser extension would make.
const CURL_FALLBACK_HOSTS = new Set(["rule34video.com", "hanime1.me", "javdb.com"]);

export function curlFallbackFor(raw: string): boolean {
  try {
    return CURL_FALLBACK_HOSTS.has(new URL(raw).hostname);
  } catch {
    return false;
  }
}

export function refererFor(raw: string): string | undefined {
  try {
    const host = new URL(raw).hostname;
    return REFERER_FOR[host] ?? (isHathHost(host) ? "https://e-hentai.org/" : undefined);
  } catch {
    return undefined;
  }
}

/** Extract an HTTP status from a LiveFetchError-ish exception. */
export function liveFetchErrorStatus(e: unknown): number {
  const status = (e as { status?: number })?.status;
  return typeof status === "number" && status >= 400 ? status : 502;
}

/** Wrap an upstream media URL into the platform proxy route (if allowed). */
export function proxyUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!isAllowedMediaUrl(raw)) return raw; // known-good public CDNs pass through
  return `/api/img?u=${encodeURIComponent(raw)}`;
}
