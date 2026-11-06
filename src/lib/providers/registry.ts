// Static registry of available provider adapters (the "extension repository").
// Installed providers are materialized as Provider rows in the database.
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
    id: "aoistream", name: "AoiStream", category: "ANIME",
    description: "Demo anime streaming adapter. Serves catalog metadata and episode streams from the local demo repository. Modeled on typical hentai-streaming sources inventoried in the Wotaku directory.",
    version: "1.4.2", author: "yozora-labs", homepage: "https://example.org/aoistream",
    capabilities: ["search", "details", "episodes", "streams", "health"],
    configSchema: [{ key: "mirror", label: "Preferred mirror", type: "select", options: ["auto", "eu", "us", "asia"], help: "Mirror used for stream resolution. 'auto' picks the fastest." }],
  },
  {
    id: "kurostream", name: "KuroStream", category: "ANIME",
    description: "Demo anime adapter with mirror configuration. Demonstrates provider configuration + health-check flows. Streams resolve only after a mirror is selected.",
    version: "0.9.7", author: "kuro-dev", homepage: "https://example.org/kurostream",
    capabilities: ["search", "details", "episodes", "streams", "health"],
    configSchema: [{ key: "mirror", label: "Stream mirror", type: "select", required: true, options: ["kuro-eu.example", "kuro-us.example"], help: "Required: pick a mirror before health checks pass." }],
  },
  {
    id: "inkscans", name: "InkScans", category: "MANGA",
    description: "Demo manga adapter modeled on scanlation-aggregator sources from the Wotaku manga tab. Provides chapter lists and page images (locally generated placeholders).",
    version: "2.1.0", author: "ink-team", homepage: "https://example.org/inkscans",
    capabilities: ["search", "details", "chapters", "pages", "download", "health"],
    configSchema: [],
  },
  {
    id: "sakurascan", name: "SakuraScan", category: "MANGA",
    description: "Second demo manga adapter. Overlaps one title with InkScans on purpose (duplicate-merge demo). Simulates occasional network jitter during health checks.",
    version: "1.0.3", author: "sakura-group", homepage: "https://example.org/sakurascan",
    capabilities: ["search", "details", "chapters", "pages", "health"],
    configSchema: [],
  },
  {
    id: "seoulink", name: "SeoulInk", category: "MANHWA",
    description: "Demo webtoon adapter (full-color, long-strip reading mode). Modeled on the Wotaku Pornhwa tab sources.",
    version: "1.7.1", author: "seoulink-dev", homepage: "https://example.org/seoulink",
    capabilities: ["search", "details", "chapters", "pages", "download", "health"],
    configSchema: [],
  },
  {
    id: "webtoonvault", name: "WebtoonVault", category: "MANHWA",
    description: "Demo webtoon adapter that ships disabled by default — install it from the Extensions repository to unlock its catalog. Items are unimported until merged.",
    version: "0.8.0", author: "vault-collective", homepage: "https://example.org/webtoonvault",
    capabilities: ["search", "details", "chapters", "pages", "health"],
    configSchema: [],
  },
  {
    id: "inkvault", name: "InkVault", category: "ILLUSTRATION",
    description: "Demo illustration-board adapter (booru-style tags, artist galleries). Requires mirror configuration before health checks pass — demonstrates provider configuration & error handling.",
    version: "1.2.5", author: "vault-labs", homepage: "https://example.org/inkvault",
    capabilities: ["search", "details", "gallery", "download", "health"],
    configSchema: [{ key: "mirror", label: "API mirror", type: "select", required: true, options: ["ink-a.example", "ink-b.example"], help: "Required. The adapter refuses to run until a mirror is configured." }],
  },
  {
    id: "arthaven", name: "ArtHaven", category: "ILLUSTRATION",
    description: "Second demo illustration adapter with per-image tagging and favorites.",
    version: "2.0.1", author: "haven-collective", homepage: "https://example.org/arthaven",
    capabilities: ["search", "details", "gallery", "download", "health"],
    configSchema: [],
  },
  {
    id: "nightflix", name: "NightFlix", category: "AV",
    description: "Demo adult-video adapter. Metadata only by default; one scene ships with a local sample stream to prove the player pipeline. Real deployments require licensed provider APIs.",
    version: "1.1.0", author: "nightflix-demo", homepage: "https://example.org/nightflix",
    capabilities: ["search", "details", "scenes", "streams", "health"],
    configSchema: [{ key: "quality", label: "Preferred quality", type: "select", options: ["auto", "1080p", "720p", "480p"] }],
  },
  {
    id: "rubytube", name: "RubyTube", category: "AV",
    description: "Tube-style demo AV adapter (tag search, scene metadata). Streams are intentionally unlicensed in this demo — the player shows an honest availability state.",
    version: "0.9.2", author: "ruby-demo", homepage: "https://example.org/rubytube",
    capabilities: ["search", "details", "scenes", "health"],
    configSchema: [],
  },
  {
    id: "playvault", name: "PlayVault", category: "GAME",
    description: "Demo adult-game catalog adapter. Links to official developer pages only — downloads in the platform are simulated for permitted demo items.",
    version: "1.5.0", author: "vault-games", homepage: "https://example.org/playvault",
    capabilities: ["search", "details", "download", "health"],
    configSchema: [],
  },
  {
    id: "velvetstore", name: "VelvetStore", category: "GAME",
    description: "Storefront-style demo adapter (disabled by default; install from Extensions). Demonstrates repository → install → import flow for games.",
    version: "0.6.0", author: "velvet-collective", homepage: "https://example.org/velvetstore",
    capabilities: ["search", "details", "download", "health"],
    configSchema: [],
  },
  {
    id: "scriptforge", name: "ScriptForge", category: "SCRIPT",
    description: "Userscript/extension catalog adapter. Scripts are listed with explicit permissions; the platform does NOT execute third-party code — installs are tracked metadata with enable/disable control.",
    version: "1.0.8", author: "forge-devs", homepage: "https://example.org/scriptforge",
    capabilities: ["search", "details", "health"],
    configSchema: [],
  },
  {
    id: "resourcebase", name: "ResourceBase", category: "MISC",
    description: "Curated guides, software and reference material for adult-platform users (privacy, safety, tooling).",
    version: "1.1.0", author: "yozora-labs", homepage: "https://example.org/resourcebase",
    capabilities: ["search", "details", "health"],
    configSchema: [],
  },
];
