// Manga & manhwa providers — real public sources.
//
// VERIFIED from sandbox (2026-11):
//  - e-hentai.org       200 (HTML search + gallery pages; documented gdata JSON API)
//  - wholesomelist.com  200 (public JSON API — curated doujin database)
//  - manga18fx.com      200 (HTML — manhwa reader, public pages)
//
// Honest limitations, stated up front:
//  - nhentai, imhentai, hentaifox etc. are Cloudflare-blocked from this
//    deployment's network — they are NOT integrated (no fake adapters).
//  - E-Hentai image resolution fetches one public page per image at import
//    time (the site's standard viewer URLs); no auth/DRM is bypassed.

import { match1, matchAll, liveJson, liveText, stripTags, htmlDecode, PLATFORM_UA, LiveFetchError } from "./http";
import type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";

// ─── E-Hentai ───

interface EhGallery {
  gid: number;
  token: string;
  title?: string;
  title_jpn?: string;
  category?: string;
  thumb?: string;
  uploader?: string;
  rating?: string | number;
  tags?: string[];
  filecount?: number;
}

async function ehGdata(entries: [number, string][]): Promise<EhGallery[]> {
  if (!entries.length) return [];
  const data = await liveJson<{ gmetadata: (EhGallery & { error?: string })[] }>(
    "https://api.e-hentai.org/api.php",
    {
      method: "POST",
      body: JSON.stringify({ method: "gdata", gidlist: entries, inline: 1 }),
      headers: { "Content-Type": "application/json" },
      cacheKey: `ehgdata:${entries.map((e) => e.join(":")).join(",")}`,
    },
  );
  return (data.gmetadata ?? []).filter((g) => !g.error);
}

function ehNormalize(g: EhGallery): LiveSearchItem {
  return {
    externalId: `${g.gid}:${g.token}`,
    title: g.title || g.title_jpn || `E-Hentai gallery ${g.gid}`,
    altTitles: [g.title_jpn].filter((t): t is string => !!t && t !== g.title),
    coverUrl: g.thumb ?? null,
    category: "MANGA",
    format: "Doujinshi",
    creator: g.uploader ?? null,
    score: g.rating != null ? Number(g.rating) : null,
    popularity: Number(g.rating ?? 0) > 0 ? Math.round(Number(g.rating) * 100) : 0,
    tags: (g.tags ?? []).map((t) => t.replace(/^[a-z]+:/, "")).slice(0, 30),
    externalUrl: `https://e-hentai.org/g/${g.gid}/${g.token}/`,
    extra: { source: "e-hentai", ehCategory: g.category ?? null },
    galleryCount: g.filecount != null ? Number(g.filecount) : null,
  };
}

async function ehSearchHtml(q: string, page: number): Promise<LiveSearchItem[]> {
  const url = `https://e-hentai.org/?f_search=${encodeURIComponent(q)}&page=${Math.max(0, page - 1)}`;
  const html = await liveText(url, { cacheKey: `ehsearch:${q}:${page}` });
  const entries: [number, string][] = [];
  const thumbs = new Map<number, string>();
  for (const m of html.matchAll(/https:\/\/e-hentai\.org\/g\/(\d+)\/([0-9a-f]{10})\//g)) {
    const gid = Number(m[1]);
    if (!entries.some((e) => e[0] === gid)) entries.push([gid, m[2]]);
  }
  // thumbnails appear as background-image or <img> near each link
  for (const m of html.matchAll(/url\((https:\/\/ehgt\.org\/[^)]+)\)/g)) {
    if (thumbs.size < entries.length) thumbs.set(thumbs.size, m[1]);
  }
  const metas = await ehGdata(entries.slice(0, 25));
  return metas.map((g, i) => ({ ...ehNormalize(g), coverUrl: g.thumb ?? thumbs.get(i) ?? null }));
}

async function ehResolvePages(galleryUrl: string, max = 120): Promise<string[]> {
  // 1) collect /s/imgkey-page-gid viewer links (incl. gallery pagination)
  const found = new Map<number, string>(); // pageNumber -> full page URL
  const collect = (html: string) => {
    // E-Hentai's viewer links: https://e-hentai.org/s/{imgkey}/{gid}-{page}
    for (const m of html.matchAll(/https:\/\/e-hentai\.org\/s\/([0-9a-f]{10})\/(\d+)-(\d+)/g)) {
      const pageNo = Number(m[3]);
      if (!found.has(pageNo)) {
        found.set(pageNo, `https://e-hentai.org/s/${m[1]}/${m[2]}-${m[3]}`);
      }
    }
  };
  collect(await liveText(galleryUrl, { cacheKey: `ehgal:${galleryUrl}` }));
  // gallery pagination links (?p=N) — fetch up to 5 extra listing pages
  const pag = new Set<number>();
  const firstHtml = await liveText(galleryUrl, { cacheKey: `ehgal2:${galleryUrl}` }).catch(() => "");
  for (const m of firstHtml.matchAll(/e-hentai\.org\/g\/\d+\/[0-9a-f]{10}\/\?p=(\d+)/g)) {
    pag.add(Number(m[1]));
  }
  for (const p of [...pag].sort((a, b) => a - b).slice(0, 5)) {
    if (found.size >= max) break;
    collect(await liveText(`${galleryUrl}?p=${p}`, { cacheKey: `ehgalp:${galleryUrl}:${p}` }).catch(() => ""));
  }
  return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, u]) => u).slice(0, max);
}

/**
 * Resolve an E-Hentai viewer page (/s/{imgkey}/{gid}-{page}) to the actual
 * image URL. Modern E-Hentai loads images through the showpage JSON API:
 * 1. GET the viewer page → extract per-session `showkey`
 * 2. POST api.e-hentai.org/api.php {method:"showpage",...} → parse i3 HTML
 * The returned H@H CDN URL carries a keystamp that expires, so callers must
 * resolve fresh (short-TTL cache) instead of persisting the final URL.
 */
export async function ehResolveImage(pageUrl: string): Promise<string | null> {
  const html = await liveText(pageUrl, { cacheKey: `ehpage:${pageUrl}`, cacheTtlMs: 10 * 60 * 1000 });
  const showkey = match1(html, /var showkey="([^"]+)"/);
  if (!showkey) return null;
  const parts = match1(pageUrl, /\/s\/([0-9a-f]{10})\/(\d+)-(\d+)/);
  if (!parts) return null;
  // parts here is only group 1 (imgkey); re-extract all groups
  const m = pageUrl.match(/\/s\/([0-9a-f]{10})\/(\d+)-(\d+)/)!;
  const [, imgkey, gid, page] = m;
  const data = await liveJson<Record<string, string>>("https://api.e-hentai.org/api.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "showpage", gid, page, imgkey, showkey }),
    cacheKey: `ehshow:${imgkey}:${showkey}`,
    cacheTtlMs: 10 * 60 * 1000,
    ua: PLATFORM_UA,
  });
  const i3 = data.i3 ?? data.i5 ?? "";
  return match1(i3, /<img id="img" src="([^"]+)"/);
}

export const EH_PAGE_RE = /^https:\/\/e-hentai\.org\/s\/[0-9a-f]{10}\/\d+-\d+$/;

export const ehentaiAdapter: LiveAdapter = {
  id: "ehentai",
  integration:
    "Public site integration (documented in e-hentai docs): HTML search → official api.php gdata metadata API → gallery page → per-image viewer pages resolved at import. No auth, DRM or paywall bypassed; only publicly served pages are read.",

  async ping() {
    // NOTE(verified 2025): EH removed the old /home/ page (now 404).
    // Probe the front page instead and assert it is actually EH HTML.
    const html = await liveText("https://e-hentai.org/", { timeoutMs: 12_000 });
    if (!/e-hentai|ehgt\.org|E-Hentai/i.test(html.slice(0, 4000))) {
      throw new LiveFetchError(502, "e-hentai.org reachable but response is not EH content");
    }
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    return ehSearchHtml(q.trim() || "full color", page);
  },

  async popular(opts) {
    return ehSearchHtml("popular", opts?.page ?? 1);
  },

  async details(externalId) {
    const [gid, token] = externalId.split(":");
    const metas = await ehGdata([[Number(gid), token]]);
    return metas[0] ? ehNormalize(metas[0]) : null;
  },

  async units(externalId) {
    const [gid, token] = externalId.split(":");
    const galleryUrl = `https://e-hentai.org/g/${gid}/${token}/`;
    const pageLinks = await ehResolvePages(galleryUrl);
    if (!pageLinks.length) return null;
    return {
      chapters: [
        {
          number: 1,
          title: "Gallery",
          pages: pageLinks,
          pageKind: "page-url",
        },
      ],
    };
  },

  /**
   * Lazy resolution: gallery page URL → E-Hentai viewer page links.
   * Final image URLs are resolved on-demand by /api/img (the H@H keystamps
   * expire, so persisting them would break re-reads).
   */
  async resolveChapter(galleryUrl: string) {
    return ehResolvePages(galleryUrl);
  },
};

// ─── WholesomeList (public JSON API) ───

interface WlEntry {
  id: number;
  hm?: string | null;
  nh?: string | null;
  eh?: string | null;
  im?: string | null;
  title: string;
  author?: string | null;
  parody?: string | null;
  tier?: string | null;
  pages?: number | null;
  image?: string | null;
  tags?: string[];
  link?: string;
}

function wlNormalize(e: WlEntry): LiveSearchItem {
  return {
    externalId: String(e.id),
    title: e.title,
    creator: e.author ?? null,
    coverUrl: e.image ?? null,
    category: "MANGA",
    format: "Doujinshi",
    tags: (e.tags ?? []).slice(0, 30),
    externalUrl: e.nh || e.eh || e.im || e.link || `https://wholesomelist.com/list/?uuid=${e.id}`,
    extra: {
      source: "wholesomelist",
      tier: e.tier ?? null,
      parody: e.parody ?? null,
      externalReadLinks: [e.nh, e.eh, e.im].filter((x): x is string => !!x),
    },
    galleryCount: e.pages ?? null,
  };
}

export const wholesomelistAdapter: LiveAdapter = {
  id: "wholesomelist",
  integration:
    "Official public JSON API of WholesomeList (wholesomelist.com/api/list) — a community-curated doujinshi database. Metadata + cover images + external reading links; it is a database, not an image host, so pages are not re-hosted.",

  async ping() {
    await liveJson<{ table: WlEntry[] }>("https://wholesomelist.com/api/list?page=1");
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const base = q.trim()
      ? `https://wholesomelist.com/api/list?page=${page}&search=${encodeURIComponent(q.trim())}`
      : `https://wholesomelist.com/api/list?page=${page}&order=tier`;
    try {
      const data = await liveJson<{ table: WlEntry[] }>(base);
      return data.table.map(wlNormalize);
    } catch {
      // search param unsupported → fall back to browsing
      const data = await liveJson<{ table: WlEntry[] }>(`https://wholesomelist.com/api/list?page=${page}&order=tier`);
      const ql = q.toLowerCase();
      return data.table.filter(
        (e) => e.title?.toLowerCase().includes(ql) || e.author?.toLowerCase().includes(ql) ||
          (e.tags ?? []).some((t) => t.toLowerCase().includes(ql)),
      ).map(wlNormalize);
    }
  },

  async popular(opts) {
    return wholesomelistAdapter.search("", opts);
  },

  async details(externalId) {
    const data = await liveJson<{ entry: WlEntry }>(`https://wholesomelist.com/api/entry/${externalId}`);
    return data.entry ? wlNormalize(data.entry) : null;
  },
};

// ─── Manga18fx (manhwa, public HTML) ───

function abs18fx(u: string): string {
  if (u.startsWith("http")) return u;
  return `https://manga18fx.com${u.startsWith("/") ? u : `/${u}`}`;
}

async function fxSeriesPage(slug: string): Promise<string> {
  return liveText(`https://manga18fx.com/manga/${slug}`, { cacheKey: `fxs:${slug}` });
}

export const manga18fxAdapter: LiveAdapter = {
  id: "manga18fx",
  integration:
    "Public website integration (Manga18 reader pages): HTML parsing of public listing, series and chapter pages. No auth, DRM or paywall is bypassed; only publicly served pages are read.",

  async ping() {
    await liveText("https://manga18fx.com/", { timeoutMs: 12_000 });
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    if (!q.trim()) {
      const html = await liveText("https://manga18fx.com/", { cacheKey: `fxhome:${page}` });
      return parseFxList(html).slice(0, 24);
    }
    const html = await liveText(
      `https://manga18fx.com/search?q=${encodeURIComponent(q)}&page=${page}`,
      { cacheKey: `fxq:${q}:${page}` },
    );
    const items = parseFxList(html);
    if (items.length) return items;
    // fallback: some deployments use /?s=
    const html2 = await liveText(`https://manga18fx.com/?s=${encodeURIComponent(q)}`, { cacheKey: `fxs2:${q}` });
    return parseFxList(html2);
  },

  async popular(opts) {
    const html = await liveText("https://manga18fx.com/", { cacheKey: `fxhome:${opts?.page ?? 1}` });
    return parseFxList(html).slice(0, 24);
  },

  async details(externalId) {
    const html = await fxSeriesPage(externalId);
    const title = stripTags(match1(html, /<h1[^>]*>([^<]+)<\/h1>/) ?? externalId);
    const cover = match1(html, /property="og:image" content="([^"]+)"/);
    const desc = stripTags(match1(html, /<div class="manga-excerpt"[^>]*>([\s\S]*?)<\/div>/) ?? "");
    const status = stripTags(match1(html, /Status:\s*<\/span>\s*<span[^>]*>([^<]+)/) ?? "");
    return {
      externalId,
      title,
      coverUrl: cover ? htmlDecode(cover) : null,
      description: desc || null,
      category: "MANHWA",
      format: "Webtoon",
      status: status || null,
      externalUrl: `https://manga18fx.com/manga/${externalId}`,
      extra: { source: "manga18fx" },
    };
  },

  async units(externalId) {
    const html = await fxSeriesPage(externalId);
    // chapter links like href="/manga/{slug}/chapter-{n}" (newest first)
    const found = new Map<string, string>(); // key "slug/chNo" -> path "slug/chNo"
    for (const m of html.matchAll(/href="\/manga\/([a-z0-9-]+)\/(chapter-[0-9.]+)"/g)) {
      const key = `${m[1]}/${m[2]}`;
      if (!found.has(key)) found.set(key, `${m[1]}/${m[2]}`);
    }
    const ordered = [...found.keys()];
    const chapters: LiveUnits["chapters"] = [];
    for (let i = ordered.length - 1, n = 1; i >= 0; i--, n++) {
      const [slug, chNo] = ordered[i].split("/");
      chapters.push({
        number: Number(chNo.replace("chapter-", "")) || n,
        title: chNo,
        pages: [`https://manga18fx.com/manga/${slug}/${chNo}`],
        pageKind: "page-url",
      });
    }
    return chapters.length ? { chapters } : null;
  },

  /** Lazy resolution: chapter page URL → real image URLs. */
  async resolveChapter(chapterPageUrl: string) {
    return fxResolveChapterImages(chapterPageUrl);
  },
};

/** Parse Manga18fx listing HTML into items (links are relative). */
function parseFxList(html: string): LiveSearchItem[] {
  const items: LiveSearchItem[] = [];
  const seen = new Set<string>();
  const re = /<a[^>]+href="\/(?:manga|comic)\/([a-z0-9-]+)"([^>]*)>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(re)) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    const attrs = m[2];
    const inner = m[3];
    const title = stripTags(match1(attrs, /title="([^"]+)"/) ?? inner);
    const img = match1(inner, /(?:data-)?src="([^"]+\.(?:webp|jpg|jpeg|png)[^"]*)"/);
    if (!title || title.length < 3) continue;
    items.push({
      externalId: slug,
      title,
      coverUrl: img ? htmlDecode(img) : null,
      category: "MANHWA",
      format: "Webtoon",
      externalUrl: `https://manga18fx.com/manga/${slug}`,
      extra: { source: "manga18fx" },
    });
    if (items.length >= 40) break;
  }
  return items;
}

/** Resolve a manga18fx chapter page into real image URLs (public pages). */
export async function fxResolveChapterImages(chapterPageUrl: string): Promise<string[]> {
  const html = await liveText(chapterPageUrl, { cacheKey: `fxc:${chapterPageUrl}` });
  // MangaStream ts_reader JSON
  const run = match1(html, /ts_reader\.run\((\{[\s\S]*?\})\);/);
  if (run) {
    try {
      const data = JSON.parse(run) as { sources?: { images?: string[] }[] };
      const imgs = data.sources?.[0]?.images ?? [];
      if (imgs.length) return imgs.map(abs18fx);
    } catch { /* fall through */ }
  }
  // plain <img> upload pages: https://img01.manga18fx.com/uploads/...
  const imgs = matchAll(html, /<img[^>]+src="(https:\/\/img[0-9]*\.manga18fx\.com\/[^"]+)"/);
  if (imgs.length) {
    const seen = new Set<string>();
    return imgs.map((u) => htmlDecode(u)).filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
  }
  return [];
}

/** Chapter page link for a manga18fx chapter number. */
export function fxChapterPageUrl(seriesSlug: string, chapterHref: string): string {
  return abs18fx(chapterHref || `/manga/${seriesSlug}`);
}
