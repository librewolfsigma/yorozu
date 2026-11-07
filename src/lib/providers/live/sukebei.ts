// Sukebei Nyaa — public torrent index RSS (https://sukebei.nyaa.si).
// VERIFIED from sandbox: RSS search returns real entries with magnets.
// Torrents/magnets are EXTERNAL download links — Yozora hosts nothing.

import { match1, liveText, stripTags } from "./http";
import type { LiveAdapter, LiveSearchItem } from "./types";

interface RssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description: string;
}

function parseSukebeiRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    items.push({
      title: stripTags(match1(b, /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) ?? ""),
      link: match1(b, /<link>([\s\S]*?)<\/link>/) ?? "",
      guid: match1(b, /<guid[^>]*>([\s\S]*?)<\/guid>/) ?? "",
      pubDate: match1(b, /<pubDate>([\s\S]*?)<\/pubDate>/) ?? "",
      description: match1(b, /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) ?? "",
    });
  }
  return items;
}

function sukebeiNormalize(r: RssItem, category: string): LiveSearchItem | null {
  if (!r.title) return null;
  const infoHash = match1(r.description, /infohash">([0-9a-f]{40})</) ?? match1(r.description, /([0-9a-f]{40})/);
  const size = stripTags(match1(r.description, /Size<\/strong>: ([^<]*)</) ?? r.description.match(/([\d.]+\s[KMG]iB)/)?.[1] ?? "");
  const seeders = Number(stripTags(match1(r.description, /Seeders<\/strong>: ([^<]*)</) ?? "0").replace(/[^\d]/g, "")) || 0;
  const magnet = infoHash
    ? `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(r.title)}&tr=udp://tracker.opentrackr.org:1337/announce`
    : null;
  const year = r.pubDate ? new Date(r.pubDate).getFullYear() : null;
  return {
    externalId: (r.guid.match(/\/download\/(\d+)/)?.[1] ?? r.guid.match(/(\d+)\.torrent/)?.[1] ?? r.guid.slice(-12)),
    title: r.title,
    category,
    format: "Torrent",
    status: "COMPLETED",
    year: Number.isFinite(year) ? year : null,
    popularity: seeders,
    externalUrl: r.link.replace("/download/", "/view/"),
    extra: {
      source: "sukebei",
      magnet,
      size,
      seeders,
      infoHash,
      downloadKind: "external-magnet",
    },
  };
}

function sukebeiSearch(q: string, page: number, category: string, catFilter: string): Promise<LiveSearchItem[]> {
  const url = `https://sukebei.nyaa.si/?page=rss&q=${encodeURIComponent(q.trim() || "*")}&c=${catFilter}&s=seeders&o=desc&p=${page}`;
  return liveText(url, { cacheKey: `skb:${q}:${page}:${catFilter}` }).then((xml) =>
    parseSukebeiRss(xml)
      .map((r) => sukebeiNormalize(r, category))
      .filter((x): x is LiveSearchItem => x !== null),
  );
}

export const sukebeiAnimeAdapter: LiveAdapter = {
  id: "sukebei-anime",
  integration:
    "Sukebei Nyaa public RSS feed (sukebei.nyaa.si/?page=rss) for anime torrents. Real titles, seeders, sizes and external magnet links. Yozora hosts nothing; downloads open the magnet in the user's own client. The wiki itself lists Sukebei as the recommended anime source.",

  async ping() {
    await sukebeiSearch("test", 1, "ANIME", "0_0");
  },

  async search(q, opts) {
    return sukebeiSearch(q || "hentai", Math.max(1, opts?.page ?? 1), "ANIME", "1_1");
  },

  async popular(opts) {
    return sukebeiSearch("*", Math.max(1, opts?.page ?? 1), "ANIME", "1_1");
  },
};

export const sukebeiMangaAdapter: LiveAdapter = {
  id: "sukebei-manga",
  integration:
    "Sukebei Nyaa public RSS feed for artbook/doujin/manga torrents. Real titles, seeders, sizes and external magnet links; downloads open the magnet in the user's own torrent client.",

  async ping() {
    await sukebeiSearch("test", 1, "MANGA", "0_0");
  },

  async search(q, opts) {
    return sukebeiSearch(q || "doujin", Math.max(1, opts?.page ?? 1), "MANGA", "1_4");
  },

  async popular(opts) {
    return sukebeiSearch("*", Math.max(1, opts?.page ?? 1), "MANGA", "1_4");
  },
};
