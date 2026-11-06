// Wotaku directory — the open-source wiki that inspired the platform's source
// inventory. Real data pulled from the public GitHub repo (wotakumoe/wotaku,
// MIT-licensed content) at request time and parsed into catalog entries.
//
// VERIFIED from sandbox: docs/nsfw.md, docs/software.md, docs/games.md,
// docs/tools.md exist in the repo's docs/ directory.

import { matchAll, liveText } from "./http";
import type { LiveAdapter, LiveSearchItem } from "./types";

const RAW = "https://raw.githubusercontent.com/wotakumoe/wotaku/main/docs";

interface WikiRow { name: string; url: string; desc: string }

/** Parse markdown tables / bullet links into rows. */
function parseWiki(md: string): WikiRow[] {
  const rows: WikiRow[] = [];
  const seen = new Set<string>();
  // table rows: | [Name](url) | desc | ...
  for (const m of md.matchAll(/\|\s*\[([^\]]+)\]\((https?:\/\/[^)\s]+)[^)]*\)\s*\|([^|]*)\|/g)) {
    const name = m[1].trim();
    const url = m[2];
    const desc = m[3].replace(/[*_`]/g, "").trim();
    if (seen.has(url)) continue;
    seen.add(url);
    rows.push({ name, url, desc });
  }
  // bullet links: - [Name](url) — desc
  for (const m of md.matchAll(/[-*]\s*\[([^\]]+)\]\((https?:\/\/[^)\s]+)[^)]*\)\s*[-—:]\s*([^\n]+)/g)) {
    const url = m[2];
    if (seen.has(url)) continue;
    seen.add(url);
    rows.push({ name: m[1].trim(), url, desc: m[3].replace(/[*_`]/g, "").trim().slice(0, 300) });
  }
  return rows;
}

async function fetchDocs(files: string[]): Promise<WikiRow[]> {
  const out: WikiRow[] = [];
  for (const f of files) {
    try {
      const md = await liveText(`${RAW}/${f}`, { cacheKey: `wotaku:${f}`, cacheTtlMs: 30 * 60 * 1000 });
      out.push(...parseWiki(md));
    } catch {
      // a missing file never breaks the adapter
    }
  }
  return out;
}

function toItems(rows: WikiRow[], category: string, format: string, source: string, q: string): LiveSearchItem[] {
  const ql = q.toLowerCase();
  return rows
    .filter((r) => !q || r.name.toLowerCase().includes(ql) || r.desc.toLowerCase().includes(ql))
    .slice(0, 40)
    .map((r, i) => ({
      externalId: Buffer.from(r.url).toString("base64url").slice(0, 40) + `:${i}`,
      title: r.name,
      description: r.desc || null,
      category,
      format,
      externalUrl: r.url,
      extra: { source, wikiUrl: r.url },
    }));
}

export const wotakuScriptsAdapter: LiveAdapter = {
  id: "wotaku-scripts",
  integration:
    "Live data from the open-source Wotaku wiki repository (github.com/wotakumoe/wotaku, docs/nsfw.md + docs/software.md — the same public directory the platform's source inventory is based on). Catalog entries carry real names, descriptions and official URLs; the platform never executes third-party scripts.",

  async ping() {
    await liveText(`${RAW}/nsfw.md`, { cacheTtlMs: 0 });
  },

  async search(q, opts) {
    const rows = await fetchDocs(["nsfw.md", "software.md", "tools.md"]);
    return toItems(rows, "SCRIPT", "Resource/Tool", "wotaku-scripts", q || "script");
  },

  async popular(opts) {
    return wotakuScriptsAdapter.search("", opts);
  },
};

export const wotakuMiscAdapter: LiveAdapter = {
  id: "wotaku-misc",
  integration:
    "Live data from the open-source Wotaku wiki repository (docs/misc.md, docs/guides — safety, privacy and reference material). Real links only; nothing is invented.",

  async ping() {
    await liveText(`${RAW}/misc.md`, { cacheTtlMs: 0 });
  },

  async search(q, opts) {
    const rows = await fetchDocs(["misc.md", "guides/index.md", "torrenting/index.md"]);
    return toItems(rows, "MISC", "Guide/Reference", "wotaku-misc", q);
  },

  async popular(opts) {
    return wotakuMiscAdapter.search("", opts);
  },
};

export const wotakuDatabasesAdapter: LiveAdapter = {
  id: "wotaku-databases",
  integration:
    "Live data from the open-source Wotaku wiki repository (databases section) — real metadata databases with official URLs. These complement the platform's built-in AniList/VNDB/Kitsu providers.",

  async ping() {
    await liveText(`${RAW}/nsfw.md`, { cacheTtlMs: 0 });
  },

  async search(q, opts) {
    const rows = await fetchDocs(["nsfw.md"]);
    const dbRows = rows.filter((r) => /database|db|metadata|scrape|index/i.test(r.desc + r.name));
    return toItems(dbRows.length ? dbRows : rows, "DATABASE", "Metadata Database", "wotaku-databases", q);
  },

  async popular(opts) {
    return wotakuDatabasesAdapter.search("", opts);
  },
};
