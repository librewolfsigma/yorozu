// Game / visual-novel providers — real public APIs.
//
// VERIFIED from sandbox (2026-11):
//  - VNDB kana API  POST https://api.vndb.org/kana/vn   200 (documented, no auth)
//  - DLsite         GET  product/info/ajax?product_id=… 200 (real RJ metadata)
//                   GET  fsr search HTML → RJ codes     200
//
// Both are metadata providers: downloads happen on the official pages.

import { matchAll, liveJson, liveText, PLATFORM_UA, stripTags } from "./http";
import type { LiveAdapter, LiveSearchItem } from "./types";

// ─── VNDB (visual novels) ───
// https://api.vndb.org/kana — public, documented, no auth for reads.

interface VndbVn {
  id: string;
  title: string;
  alttitle?: string | null;
  titles?: { title: string; lang: string; official: boolean }[];
  description?: string | null;
  image?: { url: string } | null;
  rating?: number | null;
  votecount?: number | null;
  released?: string | null;
  tags?: { name: string; rating: number; spoiler: number }[] | null;
  developers?: { name: string }[] | null;
  length_minutes?: number | null;
}

const VNDB_FIELDS =
  "id,title,alttitle,titles.title,titles.lang,titles.official,description,image.url,rating,votecount,released,tags.name,tags.rating,tags.spoiler,developers.name,length_minutes";

async function vndbQuery(filters: unknown[], sort: string, results: number, page = 1): Promise<VndbVn[]> {
  const data = await liveJson<{ results: VndbVn[]; more: boolean }>("https://api.vndb.org/kana/vn", {
    method: "POST",
    body: JSON.stringify({
      filters, fields: VNDB_FIELDS, sort, reverse: true, results,
      page,
    }),
    headers: { "Content-Type": "application/json" },
    ua: PLATFORM_UA,
    cacheKey: `vndb:${JSON.stringify(filters)}:${sort}:${results}:${page}`,
  });
  return data.results ?? [];
}

function vndbNormalize(v: VndbVn): LiveSearchItem {
  const year = v.released ? Number(v.released.slice(0, 4)) : null;
  return {
    externalId: v.id,
    title: v.title,
    altTitles: [v.alttitle, ...(v.titles ?? []).filter((t) => t.official).map((t) => t.title)].filter(
      (t): t is string => !!t && t !== v.title,
    ),
    description: v.description ? stripTags(v.description.replace(/\[url=[^\]]+\]/g, "").slice(0, 1500)) : null,
    coverUrl: v.image?.url ?? null,
    category: "GAME",
    format: "Visual Novel",
    status: v.released && v.released <= new Date().toISOString().slice(0, 10) ? "COMPLETED" : "ONGOING",
    year: Number.isFinite(year) ? year : null,
    score: v.rating != null ? v.rating / 10 : null,
    popularity: v.votecount ?? 0,
    tags: (v.tags ?? []).filter((t) => t.spoiler === 0 && t.rating >= 2).sort((a, b) => b.rating - a.rating)
      .slice(0, 20).map((t) => t.name),
    studio: v.developers?.[0]?.name ?? null,
    externalUrl: `https://vndb.org/${v.id}`,
    extra: { source: "vndb", vndbId: v.id, lengthMinutes: v.length_minutes ?? null },
  };
}

export const vndbAdapter: LiveAdapter = {
  id: "vndb",
  integration:
    "Official public kana API (api.vndb.org/kana, documented, no auth for reads). Adult VNs only via release 'ero' flag. Metadata + cover images; purchases/downloads stay on official developer/store pages.",

  async ping() {
    await vndbQuery(["search", "=", "yozora"], "searchrank", 1);
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    if (!q.trim()) return vndbAdapter.popular!(opts);
    const items = await vndbQuery(["search", "=", q.trim()], "searchrank", 30, page);
    return items.map(vndbNormalize);
  },

  async popular(opts) {
    const page = Math.max(1, opts?.page ?? 1);
    // Adult VNs = has a release with erotic content (kana API: release=has_ero)
    const items = await vndbQuery(
      ["release", "=", ["has_ero", "=", true]],
      "rating",
      30,
      page,
    );
    return items.map(vndbNormalize);
  },

  async details(externalId) {
    const items = await vndbQuery(["id", "=", externalId], "id", 1);
    return items[0] ? vndbNormalize(items[0]) : null;
  },

  async units() {
    return null; // metadata provider
  },
};

// ─── DLsite (doujin games / audio works) ───

interface DlsiteInfo {
  work_name?: string;
  work_name_kana?: string;
  maker_name?: string;
  regist_date?: string;
  age_category?: string;
  product_state?: string;
  dl_count?: number | string;
  rating_average?: number | string;
  rating_count?: number | string;
  price?: string;
  genres?: string[];
  genre?: { label?: string }[];
  work_categories?: string[];
  original_title?: string;
}

const DLSITE_BASE = "https://www.dlsite.com/maniax";

export const dlsiteAdapter: LiveAdapter = {
  id: "dlsite",
  integration:
    "DLsite public product-info AJAX endpoint (product/info/ajax) + public search pages. Real product metadata, pricing and popularity; purchases happen on dlsite.com. No circumvention of any access control.",

  async ping() {
    await liveText(DLSITE_BASE, { timeoutMs: 12_000 });
  },

  async search(q, opts) {
    const page = Math.max(1, opts?.page ?? 1);
    const keyword = q.trim() || "同人ゲーム";
    const url = `${DLSITE_BASE}/fsr/=/language/jp/keyword/${encodeURIComponent(keyword)}/order%5B0%5D/dl_d/per_page/30/page/${page}/show_type/1`;
    const html = await liveText(url, { cacheKey: `dls:${keyword}:${page}` });
    const rjs = [...new Set(matchAll(html, /product_id\/(RJ[0-9]{6,8})/))].slice(0, 24);
    const items = await Promise.all(rjs.map((rj) => dlsiteAdapter.details!(rj).catch(() => null)));
    return items.filter((x): x is LiveSearchItem => x !== null);
  },

  async popular(opts) {
    return dlsiteAdapter.search("同人ゲーム", opts);
  },

  async details(externalId) {
    const data = await liveJson<Record<string, DlsiteInfo>>(
      `${DLSITE_BASE}/product/info/ajax?product_id=${externalId}`,
      { ua: PLATFORM_UA, cacheKey: `dlsi:${externalId}` },
    );
    const info = data?.[externalId];
    if (!info || !info.work_name) return null;
    const year = info.regist_date ? Number(info.regist_date.slice(0, 4)) : null;
    const dl = Number(info.dl_count ?? 0);
    return {
      externalId,
      title: info.work_name,
      altTitles: info.original_title ? [info.original_title] : [],
      coverUrl: `https://img.dlsite.jp/resize/pub2/${externalId.match(/^.{4}/)?.[0]}/${externalId.match(/^.{6}/)?.[0]}/${externalId}/${externalId}_thumb.jpg`,
      category: "GAME",
      format: "Doujin Game",
      year: Number.isFinite(year) ? year : null,
      popularity: dl,
      genres: info.genres ?? (info.genre ?? []).map((g) => g.label ?? "").filter(Boolean),
      studio: info.maker_name ?? null,
      externalUrl: `${DLSITE_BASE}/work/=/product_id/${externalId}.html`,
      extra: {
        source: "dlsite",
        price: info.price ?? null,
        ratingAverage: info.rating_average != null ? Number(info.rating_average) : null,
        ratingCount: info.rating_count != null ? Number(info.rating_count) : null,
        ageCategory: info.age_category ?? null,
      },
    };
  },

  async units() {
    return null; // purchases/downloads happen on the official store page
  },
};
