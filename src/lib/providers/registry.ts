// Registry of REAL provider adapters. Every entry is backed by a live adapter
// in ./live/ that has been verified against its upstream before shipping.
// Installed providers are materialized as Provider rows in the database.
// "capabilities" reflect what the adapter actually implements — no promises.

export interface ProviderDef {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  author: string;
  homepage: string;
  capabilities: string[];
  configSchema: {
    key: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
    help?: string;
  }[];
}

export const PROVIDER_REGISTRY: ProviderDef[] = [
  {
    id: "anilist", name: "AniList", category: "ANIME",
    description: "Anime metadata from AniList's official public GraphQL API (docs.anilist.co). Adult titles only (genre: Hentai). Real cover art, scores, studios, episode counts. Metadata provider — playback links out to your own sources; no streams are faked.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://docs.anilist.co",
    capabilities: ["search", "details", "discover", "health"],
    configSchema: [],
  },
  {
    id: "sukebei-anime", name: "Sukebei Nyaa (Anime)", category: "ANIME",
    description: "Anime torrents from Sukebei Nyaa's public RSS feed — the source the Wotaku directory itself recommends. Real titles, seeders, sizes; downloads are external magnet links opened in your own client. Nothing is hosted or proxied.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://sukebei.nyaa.si",
    capabilities: ["search", "details", "discover", "download", "health"],
    configSchema: [],
  },
  {
    id: "e621", name: "e621", category: "ILLUSTRATION",
    description: "Illustration board using e621's official documented REST API (e621.net/help:api). Real posts, artists, tags and image URLs. Safety tag blocklist applied client-side on top of the site's own moderation.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://e621.net/help:api",
    capabilities: ["search", "details", "discover", "gallery", "download", "health"],
    configSchema: [],
  },
  {
    id: "yandere", name: "yande.re", category: "ILLUSTRATION",
    description: "Moebooru illustration board via yande.re's public post.json API. Real posts, scores and image URLs; safety tag blocklist applied.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://yande.re",
    capabilities: ["search", "details", "discover", "gallery", "download", "health"],
    configSchema: [],
  },
  {
    id: "hypnohub", name: "Hypnohub", category: "ILLUSTRATION",
    description: "Gelbooru-0.2 style board via Hypnohub's public dapi JSON endpoint. Real posts, tags and image URLs; safety tag blocklist applied.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://hypnohub.net",
    capabilities: ["search", "details", "discover", "gallery", "download", "health"],
    configSchema: [],
  },
  {
    id: "gelbooru", name: "Gelbooru", category: "ILLUSTRATION",
    description: "Gelbooru's dapi JSON API. Gelbooru requires a FREE account API key (user_id + api_key) — configure both below. Without credentials the upstream answers 401; this adapter reports that honestly instead of faking results.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://gelbooru.com",
    capabilities: ["search", "details", "discover", "gallery", "download", "health"],
    configSchema: [
      { key: "user_id", label: "User ID", type: "text", required: true, help: "Your Gelbooru account user id (free account required by the upstream API)." },
      { key: "api_key", label: "API key", type: "text", required: true, help: "Your Gelbooru API key from gelbooru.com account settings." },
    ],
  },
  {
    id: "ehentai", name: "E-Hentai", category: "MANGA",
    description: "Doujinshi/manga galleries from E-Hentai — the upstream most manga sources mirror (per the Wotaku directory). Public HTML search + the documented api.php gdata metadata API; gallery images resolved from the site's public viewer pages at import. No auth or paywall bypassed (ExHentai is not used).",
    version: "1.0.0", author: "yozora-labs", homepage: "https://e-hentai.org",
    capabilities: ["search", "details", "discover", "chapters", "pages", "download", "health"],
    configSchema: [],
  },
  {
    id: "wholesomelist", name: "WholesomeList", category: "MANGA",
    description: "Community-curated doujinshi database with an official public JSON API (wholesomelist.com/api/list). Real entries, tags, authors and external reading links; it is a database, not an image host, so pages are never re-hosted.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://wholesomelist.com",
    capabilities: ["search", "details", "discover", "health"],
    configSchema: [],
  },
  {
    id: "sukebei-manga", name: "Sukebei Nyaa (Manga)", category: "MANGA",
    description: "Doujinshi/artbook torrents from Sukebei Nyaa's public RSS feed. Real titles, seeders, sizes; downloads are external magnet links for your own torrent client.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://sukebei.nyaa.si",
    capabilities: ["search", "details", "discover", "download", "health"],
    configSchema: [],
  },
  {
    id: "manga18fx", name: "Manga18fx", category: "MANHWA",
    description: "Manhwa/webtoon reader integration via public listing, series and chapter pages. Real series metadata and chapter lists; page images are resolved from the site's public reader pages and served through Yozora's image proxy with correct attribution.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://manga18fx.com",
    capabilities: ["search", "details", "discover", "chapters", "pages", "health"],
    configSchema: [],
  },
  {
    id: "rule34video", name: "Rule34Video", category: "AV",
    description: "Adult animation/CG clips from Rule34Video (KVS-based tube site). Real listings and the publicly served MP4 playback URLs exposed by the site's own player. No auth, DRM or paywall is touched. NOTE: JAV databases (javdb, missav, javlibrary) are Cloudflare-protected against server integrations and are NOT integrated — Yozora links to them as directories instead of faking adapters.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://rule34video.com",
    capabilities: ["search", "details", "discover", "scenes", "streams", "health"],
    configSchema: [],
  },
  {
    id: "vndb", name: "VNDB", category: "GAME",
    description: "Visual novels from VNDB's official public kana API (api.vndb.org/kana, documented). Adult VNs only (releases with ero:true). Real ratings, tags, developers and cover art; purchases stay on official pages.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://api.vndb.org/kana",
    capabilities: ["search", "details", "discover", "health"],
    configSchema: [],
  },
  {
    id: "dlsite", name: "DLsite", category: "GAME",
    description: "Doujin games and audio works from DLsite's public product-info AJAX + search pages. Real titles, prices, download counts and official purchase links. Piracy is not supported — the button opens the official store page.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://www.dlsite.com",
    capabilities: ["search", "details", "discover", "health"],
    configSchema: [],
  },
  {
    id: "wotaku-databases", name: "Wotaku Databases", category: "DATABASE",
    description: "The metadata-database directory from the open-source Wotaku wiki (github.com/wotakumoe/wotaku) — the same public directory this platform's source inventory is based on. Real entries, real URLs, fetched live at request time.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://wotaku.wiki",
    capabilities: ["search", "discover", "health"],
    configSchema: [],
  },
  {
    id: "wotaku-scripts", name: "Wotaku Scripts & Tools", category: "SCRIPT",
    description: "Userscripts, extensions and tooling catalogued live from the open-source Wotaku wiki repository. Real names, descriptions and official URLs. Yozora never executes third-party code — entries are links plus permission-style metadata.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://wotaku.wiki",
    capabilities: ["search", "discover", "health"],
    configSchema: [],
  },
  {
    id: "wotaku-misc", name: "Wotaku Guides & Misc", category: "MISC",
    description: "Safety, privacy and reference material fetched live from the open-source Wotaku wiki repository. Real guides with official URLs — curated for adults operating in this space.",
    version: "1.0.0", author: "yozora-labs", homepage: "https://wotaku.wiki",
    capabilities: ["search", "discover", "health"],
    configSchema: [],
  },
];

// Providers installed by default on a fresh database.
export const DEFAULT_INSTALLED = PROVIDER_REGISTRY.map((p) => p.id);
