/**
 * Yozora database seeder.
 * Populates: providers (demo adapters), provider catalog items, unified media
 * (deduplicated across providers), episodes/chapters/pages/gallery images,
 * characters, people, tags, and a ready-to-use demo account.
 *
 * All titles are FICTIONAL. All depicted characters are adults (18+).
 * Cover/page/gallery imagery is generated locally as abstract SVG placeholders
 * (no explicit media is shipped with the platform).
 */
import { PrismaClient } from "@prisma/client";
import {
  accentFor, avatarUrl, bannerUrl, coverUrl, galleryUrl, normalizeTitle,
  pageUrl, planUnits, slugify, thumbUrl,
} from "../src/lib/content-factory";

const db = new PrismaClient();

// ─────────────────────────── helpers ───────────────────────────
function jitter(rand: () => number, base: number, spread: number) {
  return Math.round(base + (rand() * 2 - 1) * spread);
}
function popScore(rand: () => number) {
  return Math.round((6.4 + rand() * 2.9) * 10) / 10;
}
const FLAG_MEDIA = JSON.stringify([
  "Explicit adult content (18+)",
  "All depicted characters are fictional adults (18+)",
]);
const FLAG_AV = JSON.stringify([
  "All performers are verified adults (18+)",
  "Produced under documented consent policies",
  "Demo placeholder content — no real explicit media",
]);

interface SeedItem {
  title: string;
  alt?: string[];
  desc: string;
  format: string;
  status: string;
  year: number;
  genres: string[];
  tags: string[];
  studio?: string;
  creator?: string;
  eps?: number;
  chs?: number;
  scenes?: number;
  images?: number;
  imported?: boolean;
  externalUrl?: string;
  extra?: Record<string, unknown>;
}

interface SeedProvider {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  author: string;
  homepage: string;
  capabilities: string[];
  configSchema: { key: string; label: string; type: string; required?: boolean; options?: string[]; help?: string }[];
  installed: boolean;
  status?: string;
  items: SeedItem[];
}

const P = (b: boolean) => JSON.stringify(b);
const A = (arr: string[]) => JSON.stringify(arr);

// ─────────────────────────── provider + catalog data ───────────────────────────
const PROVIDERS: SeedProvider[] = [
  {
    id: "aoistream", name: "AoiStream", category: "ANIME",
    description: "Demo anime streaming adapter. Serves catalog metadata and episode streams from the local demo repository. Modeled on typical hentai-streaming sources inventoried in the Wotaku directory.",
    version: "1.4.2", author: "yozora-labs", homepage: "https://example.org/aoistream",
    capabilities: ["search", "details", "episodes", "streams", "health"],
    configSchema: [{ key: "mirror", label: "Preferred mirror", type: "select", options: ["auto", "eu", "us", "asia"], help: "Mirror used for stream resolution. 'auto' picks the fastest." }],
    installed: true,
    items: [
      { title: "Sakura Nightfall", alt: ["サクラ・ナイトフォール"], desc: "By day, Kaede is a reserved florist in old Tokyo; by night, the city's neon district belongs to her. A supernatural romance between adults about the deals we make after midnight.", format: "TV", status: "ONGOING", year: 2024, genres: ["Ecchi", "Supernatural", "Romance"], tags: ["Urban Fantasy", "Youkai", "Adult Cast", "Nightlife"], studio: "Studio Kagami", eps: 12 },
      { title: "Harem Dormitory!!", alt: ["ハーレム下宿!!"], desc: "Five adult roommates, one share-house, zero privacy. A comedy about the world's most crowded twenty-something dormitory.", format: "TV", status: "COMPLETED", year: 2023, genres: ["Comedy", "Harem", "Ecchi"], tags: ["Share House", "Adult Cast", "Slice of Life"], studio: "Studio Kagami", eps: 12 },
      { title: "Crimson Lust Chronicles", alt: ["紅蓮の年代記"], desc: "In a kingdom where magic is sealed by vows of restraint, a mercenary and a temple oracle break every rule. Dark fantasy for adults.", format: "OVA", status: "ONGOING", year: 2024, genres: ["Fantasy", "Action", "Ecchi"], tags: ["Magic", "Vows", "Adult Cast", "Gore-free"], studio: "Kurenai Works", eps: 4 },
      { title: "Velvet Blades", alt: ["ベルベット・ブレイド"], desc: "A duelist retires to teach fencing at an adults-only academy, where every lesson is a negotiation. Feature film.", format: "Movie", status: "COMPLETED", year: 2022, genres: ["Action", "Drama", "Ecchi"], tags: ["Fencing", "Academy", "Adult Cast"], studio: "Studio Kagami", eps: 1 },
      { title: "Fox Spirit Fever", alt: ["狐の熱"], desc: "A fox spirit catches 'human fever' after one night in the city. Romantic comedy between a 500-year-old fox (appearing as an adult woman) and a 28-year-old bartender.", format: "TV", status: "ONGOING", year: 2024, genres: ["Romance", "Comedy", "Supernatural"], tags: ["Youkai", "Adult Cast", "Slow Burn"], studio: "Kurenai Works", eps: 12 },
      { title: "Maid Cafe Midnight", alt: ["メイド喫茶・ミッドナイト"], desc: "The maids of Café Midnight only work after the last train. A workplace drama about the adults who keep Akihabara's lights on.", format: "TV", status: "ONGOING", year: 2025, genres: ["Drama", "Ecchi", "Slice of Life"], tags: ["Workplace", "Adult Cast", "Maid Cafe"], studio: "Studio Kagami", eps: 10 },
    ],
  },
  {
    id: "kurostream", name: "KuroStream", category: "ANIME",
    description: "Demo anime adapter with mirror configuration. Demonstrates provider configuration + health-check flows. Streams resolve only after a mirror is selected.",
    version: "0.9.7", author: "kuro-dev", homepage: "https://example.org/kurostream",
    capabilities: ["search", "details", "episodes", "streams", "health"],
    configSchema: [{ key: "mirror", label: "Stream mirror", type: "select", required: true, options: ["kuro-eu.example", "kuro-us.example"], help: "Required: pick a mirror before health checks pass." }],
    installed: true,
    items: [
      { title: "Fox Spirit Fever", desc: "Mirror-side listing of the same series — used by the platform to demonstrate cross-provider duplicate detection and metadata normalization.", format: "TV", status: "ONGOING", year: 2024, genres: ["Romance", "Comedy", "Supernatural"], tags: ["Youkai", "Adult Cast"], studio: "Kurenai Works", eps: 12 },
      { title: "Star Maidens: First Contact", alt: ["スターメイデン"], desc: "The first alien delegation insists that diplomatic relations begin in the bedroom. A sci-fi comedy between adult humans and adult aliens.", format: "TV", status: "ONGOING", year: 2025, genres: ["Sci-Fi", "Ecchi", "Comedy"], tags: ["Space", "First Contact", "Adult Cast"], studio: "Studio Kagami", eps: 8 },
      { title: "Winter Semester Affairs", alt: ["冬学期"], desc: "Adult-education night classes, where every student is over 25 and every confession happens after hours.", format: "TV", status: "COMPLETED", year: 2021, genres: ["Romance", "Drama", "Ecchi"], tags: ["Adult Cast", "Night School"], studio: "Kurenai Works", eps: 10 },
    ],
  },
  {
    id: "inkscans", name: "InkScans", category: "MANGA",
    description: "Demo manga adapter modeled on scanlation-aggregator sources from the Wotaku manga tab. Provides chapter lists and page images (locally generated placeholders).",
    version: "2.1.0", author: "ink-team", homepage: "https://example.org/inkscans",
    capabilities: ["search", "details", "chapters", "pages", "download", "health"],
    configSchema: [],
    installed: true,
    items: [
      { title: "Midnight Library of Desires", alt: ["真夜中の図書館"], desc: "A private library where each forbidden book trades a memory for a night. Seinen romance for adults.", format: "Manga", status: "ONGOING", year: 2023, genres: ["Romance", "Fantasy", "Drama"], tags: ["Library", "Contract", "Adult Cast", "Psychological"], creator: "Aoi Yamazaki", chs: 18 },
      { title: "Office Romance Protocol", desc: "Two rival product managers discover their companies are merging — and so are their hotel bookings. Office comedy, 30-something leads.", format: "Manga", status: "ONGOING", year: 2024, genres: ["Romance", "Comedy", "Slice of Life"], tags: ["Office", "Adult Cast", "Rivals to Lovers"], creator: "Aoi Yamazaki", chs: 14 },
      { title: "Bathhouse Encounters", desc: "An old sento where the steam makes everyone honest. Interlinked one-shots about the adults of one neighborhood.", format: "Manga", status: "COMPLETED", year: 2022, genres: ["Romance", "Ecchi", "Slice of Life"], tags: ["Bathhouse", "Anthology", "Adult Cast"], creator: "Mika Onoda", chs: 24 },
      { title: "Demon Lord's Bride", desc: "She summoned a demon lord; he filed for a marriage license. Fantasy romance, adult leads.", format: "Manga", status: "ONGOING", year: 2025, genres: ["Fantasy", "Romance", "Comedy"], tags: ["Summoning", "Marriage of Convenience", "Adult Cast"], creator: "Hana Kim", chs: 9 },
      { title: "Velvet Hours", desc: "A jazz bar that only admits couples on the rebound. Vignette stories about second chances.", format: "Manga", status: "COMPLETED", year: 2021, genres: ["Drama", "Romance", "Ecchi"], tags: ["Jazz Bar", "Anthology", "Adult Cast"], creator: "Mika Onoda", chs: 16 },
    ],
  },
  {
    id: "sakurascan", name: "SakuraScan", category: "MANGA",
    description: "Second demo manga adapter. Overlaps one title with InkScans on purpose (duplicate-merge demo). Simulates occasional network jitter during health checks.",
    version: "1.0.3", author: "sakura-group", homepage: "https://example.org/sakurascan",
    capabilities: ["search", "details", "chapters", "pages", "health"],
    configSchema: [],
    installed: true,
    items: [
      { title: "Midnight Library of Desires", desc: "Mirror listing of the InkScans title — merged by the unified database via title normalization.", format: "Manga", status: "ONGOING", year: 2023, genres: ["Romance", "Fantasy", "Drama"], tags: ["Library", "Adult Cast"], creator: "Aoi Yamazaki", chs: 18 },
      { title: "Fox Rain Diaries", desc: "Rainy-season romance between a shrine keeper and the fox she grew up with (both adults).", format: "Manga", status: "ONGOING", year: 2024, genres: ["Romance", "Supernatural"], tags: ["Shrine", "Youkai", "Adult Cast"], creator: "Hana Kim", chs: 11 },
      { title: "Gallery of Second Chances", desc: "An art restorer falls for the forger whose work she keeps uncovering.", format: "Manga", status: "COMPLETED", year: 2023, genres: ["Drama", "Romance"], tags: ["Art World", "Adult Cast"], creator: "Mika Onoda", chs: 13 },
      { title: "Unsubtle Confessions", desc: "Four roommates, one whiteboard, and the world's most direct dating policy.", format: "Manga", status: "ONGOING", year: 2025, genres: ["Comedy", "Romance", "Harem"], tags: ["Share House", "Adult Cast"], creator: "Aoi Yamazaki", chs: 7 },
    ],
  },
  {
    id: "seoulink", name: "SeoulInk", category: "MANHWA",
    description: "Demo webtoon adapter (full-color, long-strip reading mode). Modeled on the Wotaku Pornhwa tab sources.",
    version: "1.7.1", author: "seoulink-dev", homepage: "https://example.org/seoulink",
    capabilities: ["search", "details", "chapters", "pages", "download", "health"],
    configSchema: [],
    installed: true,
    items: [
      { title: "My Boss Is a Vampire", desc: "Night-shift paralegal by day, blood-bank donor by night: Yuna's boss has excellent dental benefits. Full-color adult webtoon.", format: "Webtoon", status: "ONGOING", year: 2024, genres: ["Romance", "Supernatural", "Comedy"], tags: ["Office", "Vampire", "Full Color", "Adult Cast"], creator: "Hana Kim", chs: 22 },
      { title: "Tower of Desire", desc: "Every 100 floors grants one honest answer about what you truly want. Climbers wanted. Adults only.", format: "Webtoon", status: "ONGOING", year: 2023, genres: ["Fantasy", "Action", "Drama"], tags: ["Tower", "Full Color", "Adult Cast"], creator: "Joon Park", chs: 30 },
      { title: "Double Life Secretary", desc: "Her boss thinks she's orthodox; her book club knows better. A comedy of manageable errors.", format: "Webtoon", status: "ONGOING", year: 2025, genres: ["Romance", "Comedy", "Slice of Life"], tags: ["Office", "Full Color", "Adult Cast"], creator: "Sena Cho", chs: 12 },
      { title: "Bedside Manner", desc: "A night-shift resident and the paramedic who keeps bringing her coffee. Medical romance, adult leads.", format: "Webtoon", status: "COMPLETED", year: 2022, genres: ["Romance", "Drama"], tags: ["Hospital", "Full Color", "Adult Cast"], creator: "Sena Cho", chs: 20 },
      { title: "Innkeeper Chronicles", desc: "A mountain inn where the hot springs dissolve secrets faster than the guests can keep them.", format: "Webtoon", status: "ONGOING", year: 2024, genres: ["Romance", "Slice of Life", "Ecchi"], tags: ["Inn", "Hot Springs", "Full Color", "Adult Cast"], creator: "Joon Park", chs: 16 },
    ],
  },
  {
    id: "webtoonvault", name: "WebtoonVault", category: "MANHWA",
    description: "Demo webtoon adapter that ships disabled by default — install it from the Extensions repository to unlock its catalog. Items are unimported until merged.",
    version: "0.8.0", author: "vault-collective", homepage: "https://example.org/webtoonvault",
    capabilities: ["search", "details", "chapters", "pages", "health"],
    configSchema: [],
    installed: false,
    items: [
      { title: "Painted Skin Judge", imported: false, desc: "A court painter sees the truth on every face. Historical intrigue for adults.", format: "Webtoon", status: "ONGOING", year: 2024, genres: ["Historical", "Drama", "Romance"], tags: ["Court Intrigue", "Full Color", "Adult Cast"], creator: "Joon Park", chs: 14 },
      { title: "CEO's Secret Contract", imported: false, desc: "Clause 12: all negotiations conclude in the penthouse. Contract romance parody.", format: "Webtoon", status: "ONGOING", year: 2025, genres: ["Romance", "Comedy"], tags: ["Office", "Contract", "Full Color", "Adult Cast"], creator: "Sena Cho", chs: 10 },
    ],
  },
  {
    id: "inkvault", name: "InkVault", category: "ILLUSTRATION",
    description: "Demo illustration-board adapter (booru-style tags, artist galleries). Requires mirror configuration before health checks pass — demonstrates provider configuration & error handling.",
    version: "1.2.5", author: "vault-labs", homepage: "https://example.org/inkvault",
    capabilities: ["search", "details", "gallery", "download", "health"],
    configSchema: [{ key: "mirror", label: "API mirror", type: "select", required: true, options: ["ink-a.example", "ink-b.example"], help: "Required. The adapter refuses to run until a mirror is configured." }],
    installed: true,
    items: [
      { title: "Kuroneko-sensei Art Pack Vol. 3", desc: "Artist gallery: ink-and-watercolor pin-ups of original adult characters. Booru-style tags on every image.", format: "Gallery", status: "COMPLETED", year: 2024, genres: ["Illustration", "Ecchi"], tags: ["Original", "Pin-up", "Watercolor", "Adult (18+)"], creator: "Kuroneko-sensei", images: 24 },
      { title: "Fantasy Ero-Art Collection", desc: "Curated multi-artist collection: sorceresses, knights and courtiers of fictional realms, all adults.", format: "Gallery", status: "COMPLETED", year: 2023, genres: ["Illustration", "Fantasy"], tags: ["Multi-artist", "Fantasy", "Curated", "Adult (18+)"], creator: "Various", images: 28 },
      { title: "Cyberpunk Nights Pack", desc: "Neon, rain and chrome. Original cyberpunk pin-up sets by three studio artists.", format: "Gallery", status: "ONGOING", year: 2025, genres: ["Illustration", "Sci-Fi"], tags: ["Cyberpunk", "Neon", "Original", "Adult (18+)"], creator: "Pixelmage", images: 18 },
      { title: "Ukiyo-e Revival: Modern Beauties", desc: "Modern homage to shunga woodblock traditions — historical adult art form, recreated respectfully with original adult subjects.", format: "Gallery", status: "COMPLETED", year: 2022, genres: ["Illustration", "Historical"], tags: ["Ukiyo-e", "Shunga homage", "Adult (18+)"], creator: "Kuroneko-sensei", images: 14 },
    ],
  },
  {
    id: "arthaven", name: "ArtHaven", category: "ILLUSTRATION",
    description: "Second demo illustration adapter with per-image tagging and favorites.",
    version: "2.0.1", author: "haven-collective", homepage: "https://example.org/arthaven",
    capabilities: ["search", "details", "gallery", "download", "health"],
    configSchema: [],
    installed: true,
    items: [
      { title: "Aoi & Ren: Couple Series", desc: "Ongoing couple series by a two-artist studio — thirty-something pair, eleven years together.", format: "Gallery", status: "ONGOING", year: 2024, genres: ["Illustration", "Romance"], tags: ["Couple", "Original", "Adult (18+)"], creator: "Studio Nanairo", images: 22 },
      { title: "Deity Portraits: Goddesses of the Realm", desc: "Regal portraits of fictional adult goddesses. Baroque palette, gold leaf effects.", format: "Gallery", status: "COMPLETED", year: 2023, genres: ["Illustration", "Fantasy"], tags: ["Deity", "Baroque", "Adult (18+)"], creator: "Erika Vance", images: 16 },
      { title: "Summer Festival After Dark", desc: "Yukata, lanterns and sparklers — after the families go home. Original adult cast.", format: "Gallery", status: "COMPLETED", year: 2024, genres: ["Illustration", "Slice of Life"], tags: ["Matsuri", "Yukata", "Adult (18+)"], creator: "Studio Nanairo", images: 20 },
      { title: "Mechanical Muse: Mecha Girls", desc: "Pin-ups with powered exosuits. Engineering sketches included.", format: "Gallery", status: "ONGOING", year: 2025, genres: ["Illustration", "Sci-Fi"], tags: ["Mecha", "Pin-up", "Adult (18+)"], creator: "Pixelmage", images: 12 },
    ],
  },
  {
    id: "nightflix", name: "NightFlix", category: "AV",
    description: "Demo adult-video adapter. Metadata only by default; one scene ships with a local sample stream to prove the player pipeline. Real deployments require licensed provider APIs.",
    version: "1.1.0", author: "nightflix-demo", homepage: "https://example.org/nightflix",
    capabilities: ["search", "details", "scenes", "streams", "health"],
    configSchema: [{ key: "quality", label: "Preferred quality", type: "select", options: ["auto", "1080p", "720p", "480p"] }],
    installed: true,
    items: [
      { title: "Tokyo Nights Vol. 4", desc: "Anthology feature from Velvet Rose Productions. All performers verified adults; consent documentation on file. Ships with a local sample stream for platform testing.", format: "Feature", status: "COMPLETED", year: 2024, genres: ["Romance", "Anthology"], tags: ["Studio", "Anthology", "Verified performers"], studio: "Velvet Rose Productions", scenes: 4 },
      { title: "After Hours: Office Encounter", desc: "Two coworkers, one elevator, forty minutes. Studio feature, verified adult cast.", format: "Feature", status: "COMPLETED", year: 2023, genres: ["Romance", "Office"], tags: ["Studio", "Verified performers"], studio: "Velvet Rose Productions", scenes: 3 },
      { title: "Beach Resort Diary", desc: "Vacation vignettes filmed on location with a returning adult couple.", format: "Feature", status: "COMPLETED", year: 2024, genres: ["Couples"], tags: ["Location", "Couples", "Verified performers"], studio: "Aozora Films", scenes: 5 },
      { title: "Silent Library", desc: "Quiet-set feature shot in a closed library after hours. Experimental sound design.", format: "Feature", status: "COMPLETED", year: 2022, genres: ["Experimental"], tags: ["Studio", "Experimental", "Verified performers"], studio: "Aozora Films", scenes: 3 },
    ],
  },
  {
    id: "rubytube", name: "RubyTube", category: "AV",
    description: "Tube-style demo AV adapter (tag search, scene metadata). Streams are intentionally unlicensed in this demo — the player shows an honest availability state.",
    version: "0.9.2", author: "ruby-demo", homepage: "https://example.org/rubytube",
    capabilities: ["search", "details", "scenes", "health"],
    configSchema: [],
    installed: true,
    items: [
      { title: "Neon District Stories", desc: "Interview-format series with adult performers discussing their craft. SFW interviews + scenes.", format: "Series", status: "ONGOING", year: 2025, genres: ["Documentary"], tags: ["Interview", "Verified performers"], studio: "Ruby House", scenes: 4 },
      { title: "Winter Cabin Getaway", desc: "Snowbound cabin, two verified adult performers, one fireplace.", format: "Feature", status: "COMPLETED", year: 2023, genres: ["Couples"], tags: ["Location", "Couples", "Verified performers"], studio: "Ruby House", scenes: 3 },
      { title: "Anniversary Suite", desc: "Golden-anniversary-couple's gift to each other: a professionally filmed weekend. Import this item from the provider catalog to test the import pipeline.", format: "Feature", status: "COMPLETED", year: 2024, genres: ["Couples"], tags: ["Studio", "Couples", "Verified performers"], studio: "Velvet Rose Productions", scenes: 2, imported: false },
    ],
  },
  {
    id: "playvault", name: "PlayVault", category: "GAME",
    description: "Demo adult-game catalog adapter. Links to official developer pages only — downloads in the platform are simulated for permitted demo items.",
    version: "1.5.0", author: "vault-games", homepage: "https://example.org/playvault",
    capabilities: ["search", "details", "download", "health"],
    configSchema: [],
    installed: true,
    items: [
      { title: "Moonlit Kingdom", desc: "Hand-painted visual novel / light RPG about a border kingdom where treaties are sealed at midnight. Adult cast, all 18+.", format: "VN", status: "COMPLETED", year: 2023, genres: ["Visual Novel", "RPG", "Romance"], tags: ["Hand-painted", "Choices matter", "Adult (18+)"], creator: "Team Umbra", extra: { engine: "RPG Maker MZ", platforms: ["Windows", "macOS", "Linux"], sizeGb: 2.4, version: "1.3.1", officialUrl: "https://example.org/moonlit-kingdom", requirements: { os: "Win 10+ / macOS 12+", cpu: "2.0 GHz dual-core", ram: "4 GB", storage: "3 GB" } } },
      { title: "Dungeon Breeders", desc: "Roguelite dungeon management with creature husbandry. Cartoonish, adult characters only.", format: "Game", status: "ONGOING", year: 2024, genres: ["Roguelite", "Strategy"], tags: ["Dungeon", "Management", "Adult (18+)"], creator: "Pixelmage Games", extra: { engine: "Unity", platforms: ["Windows", "Linux"], sizeGb: 1.1, version: "0.9.4", officialUrl: "https://example.org/dungeon-breeders", requirements: { os: "Win 10+", cpu: "2.5 GHz quad-core", ram: "8 GB", storage: "2 GB" } } },
      { title: "Harem Crafting", desc: "Sandbox crafting sim: build the inn, recruit the staff, manage the mood. Every character is an adult with opinions.", format: "Game", status: "ONGOING", year: 2025, genres: ["Sandbox", "Simulation"], tags: ["Base building", "Sandbox", "Adult (18+)"], creator: "Team Umbra", extra: { engine: "Godot", platforms: ["Windows", "macOS", "Linux"], sizeGb: 0.8, version: "0.4.0", officialUrl: "https://example.org/harem-crafting", requirements: { os: "Win 10+", cpu: "2.0 GHz", ram: "4 GB", storage: "1.5 GB" } } },
      { title: "Sunset Café Manager", desc: "Cozy management sim with an all-adult evening staff and a very mild ecchi streak.", format: "Game", status: "COMPLETED", year: 2022, genres: ["Management", "Ecchi"], tags: ["Cozy", "Management", "Adult (18+)"], creator: "Pixelmage Games", extra: { engine: "Godot", platforms: ["Windows", "macOS"], sizeGb: 0.6, version: "2.1.0", officialUrl: "https://example.org/sunset-cafe", requirements: { os: "Win 10+ / macOS 12+", cpu: "1.8 GHz", ram: "4 GB", storage: "1 GB" } } },
    ],
  },
  {
    id: "velvetstore", name: "VelvetStore", category: "GAME",
    description: "Storefront-style demo adapter (disabled by default; install from Extensions). Demonstrates repository → install → import flow for games.",
    version: "0.6.0", author: "velvet-collective", homepage: "https://example.org/velvetstore",
    capabilities: ["search", "details", "download", "health"],
    configSchema: [],
    installed: false,
    items: [
      { title: "Neon Vice: 2077", imported: false, desc: "Cyberpunk investigative RPG. Fictional adult cast; gritty but performer-free (drawn art).", format: "Game", status: "ONGOING", year: 2025, genres: ["RPG", "Cyberpunk"], tags: ["Investigation", "Adult (18+)"], creator: "Studio Neonvice", extra: { engine: "Unity", platforms: ["Windows"], sizeGb: 9.5, version: "0.7.2", officialUrl: "https://example.org/neon-vice", requirements: { os: "Win 11", cpu: "4-core 3.2 GHz", ram: "16 GB", storage: "12 GB" } } },
      { title: "Sakura Dungeon Delux", imported: false, desc: "First-person dungeon crawler remaster with card-based encounters.", format: "Game", status: "COMPLETED", year: 2023, genres: ["Dungeon Crawler"], tags: ["Remaster", "Adult (18+)"], creator: "Team Umbra", extra: { engine: "RPG Maker MV", platforms: ["Windows", "macOS", "Linux"], sizeGb: 1.8, version: "1.0.0", officialUrl: "https://example.org/sakura-dungeon", requirements: { os: "Win 10+", cpu: "2.0 GHz", ram: "4 GB", storage: "2.5 GB" } } },
    ],
  },
  {
    id: "scriptforge", name: "ScriptForge", category: "SCRIPT",
    description: "Userscript/extension catalog adapter. Scripts are listed with explicit permissions; the platform does NOT execute third-party code — installs are tracked metadata with enable/disable control.",
    version: "1.0.8", author: "forge-devs", homepage: "https://example.org/scriptforge",
    capabilities: ["search", "details", "health"],
    configSchema: [],
    installed: true,
    items: [
      { title: "TrackSync — AniList/MAL Sync Bridge", desc: "Userscript that syncs your Yozora progress into AniList/MyAnimeList lists when you use those sites.", format: "Userscript", status: "COMPLETED", year: 2024, genres: ["Tracking"], tags: ["Sync", "Userscript"], creator: "forge-devs", extra: { version: "3.2.1", sourceUrl: "https://example.org/tracksync", installs: 18420, permissions: [{ domain: "anilist.co", reason: "Write list entries" }, { domain: "myanimelist.net", reason: "Write list entries" }] } },
      { title: "Gallery Infinite Scroll+", desc: "Adds fast infinite scroll and keyboard navigation to booru-style galleries.", format: "Userscript", status: "COMPLETED", year: 2023, genres: ["Browsing"], tags: ["QoL", "Userscript"], creator: "forge-devs", extra: { version: "1.9.0", sourceUrl: "https://example.org/gis", installs: 42110, permissions: [{ domain: "*.booru", reason: "Enhance gallery pages" }] } },
      { title: "Scene Skipper", desc: "Player hotkeys, intro detection controls and timestamp bookmarks for supported players.", format: "Extension", status: "COMPLETED", year: 2024, genres: ["Playback"], tags: ["Player", "Extension"], creator: "forge-devs", extra: { version: "0.7.4", sourceUrl: "https://example.org/sceneskipper", installs: 9840, permissions: [{ domain: "player.yozora.local", reason: "Attach player controls" }] } },
      { title: "Library Stats Dashboard", desc: "Adds reading/watching statistics widgets to your profile page.", format: "Userscript", status: "COMPLETED", year: 2025, genres: ["Tracking"], tags: ["Stats", "Userscript"], creator: "forge-devs", extra: { version: "1.2.0", sourceUrl: "https://example.org/libstats", installs: 7310, permissions: [{ domain: "yozora.local", reason: "Read your own library data" }] } },
      { title: "Site Blocker Plus", desc: "Adult-platform wellbeing tool: time limits, cool-down screens, and focus schedules.", format: "Extension", status: "COMPLETED", year: 2023, genres: ["Wellbeing"], tags: ["Wellbeing", "Extension"], creator: "forge-devs", extra: { version: "2.4.2", sourceUrl: "https://example.org/blockerplus", installs: 25330, permissions: [{ domain: "yozora.local", reason: "Show cool-down screens" }] } },
    ],
  },
  {
    id: "resourcebase", name: "ResourceBase", category: "MISC",
    description: "Curated guides, software and reference material for adult-platform users (privacy, safety, tooling).",
    version: "1.1.0", author: "yozora-labs", homepage: "https://example.org/resourcebase",
    capabilities: ["search", "details", "health"],
    configSchema: [],
    installed: true,
    items: [
      { title: "Privacy & Safety Guide for Adult Platforms", desc: "Practical guide: tracker blocking, account hygiene, payment privacy and safe browsing for adult sites. Based on the Wotaku directory's safety recommendations.", format: "Guide", status: "COMPLETED", year: 2025, genres: ["Guide", "Safety"], tags: ["Privacy", "Safety", "Reference"], externalUrl: "https://wotaku.wiki/nsfw", extra: { kind: "guide" } },
      { title: "Wotaku NSFW Directory", desc: "The community directory this platform's source research is based on. Browse it for more sources, apps and databases.", format: "Reference", status: "COMPLETED", year: 2025, genres: ["Reference"], tags: ["Directory", "Community"], externalUrl: "https://wotaku.wiki/nsfw", extra: { kind: "reference" } },
      { title: "qBittorrent", desc: "Free, adless BitTorrent client — the standard recommendation in the Wotaku software tab for legal, permitted downloads.", format: "Software", status: "COMPLETED", year: 2025, genres: ["Software"], tags: ["Downloads", "Open source"], externalUrl: "https://www.qbittorrent.org/", extra: { kind: "software" } },
      { title: "VPNs: A Practical Guide", desc: "When VPNs help, when they don't, and how to evaluate providers for privacy on adult platforms.", format: "Guide", status: "COMPLETED", year: 2024, genres: ["Guide", "Privacy"], tags: ["VPN", "Privacy"], externalUrl: "https://www.privacyguides.org/en/vpn/", extra: { kind: "guide" } },
      { title: "Tag Translation Dictionary (JP↔EN)", desc: "Community dictionary for Japanese adult-content tags with context notes — referenced by the platform's tag browser.", format: "Reference", status: "ONGOING", year: 2024, genres: ["Reference"], tags: ["Dictionary", "Tags"], externalUrl: "https://wotaku.wiki/nsfw", extra: { kind: "reference" } },
    ],
  },
];

// ─────────────────────────── characters & people ───────────────────────────
const CHARACTERS = [
  { name: "Kaede Sakura", desc: "24-year-old florist by day; keeper of the Nightfall district by night.", media: ["Sakura Nightfall"], role: "MAIN" },
  { name: "Ren Amagase", desc: "28-year-old bartender whose bar sits exactly on the district's border.", media: ["Sakura Nightfall", "Fox Spirit Fever"], role: "MAIN" },
  { name: "Yui Hoshino", desc: "Adult delegate of the Meridian fleet; diplomatic protocol enthusiast.", media: ["Star Maidens: First Contact"], role: "MAIN" },
  { name: "Aoi Tsukishima", desc: "26-year-old astronomy grad student; first human to RSVP to the fleet.", media: ["Star Maidens: First Contact"], role: "SUPPORTING" },
  { name: "Mika Tsukino", desc: "25-year-old maid and shift lead at Café Midnight; keeps the espresso honest.", media: ["Maid Cafe Midnight"], role: "MAIN" },
  { name: "Sora Hakuin", desc: "29-year-old novelist who writes at table nine every night.", media: ["Maid Cafe Midnight"], role: "SUPPORTING" },
  { name: "Kazan the Crimson", desc: "A 300-year-old mercenary (adult by any species' measure).", media: ["Crimson Lust Chronicles"], role: "MAIN" },
  { name: "Oracle Suzune", desc: "Temple oracle, 31; her vows never covered mercy.", media: ["Crimson Lust Chronicles"], role: "MAIN" },
  { name: "Tsubaki Rin", desc: "Fencing instructor, 34; duels at dawn, teatime negotiations after.", media: ["Velvet Blades"], role: "MAIN" },
  { name: "Kohaku", desc: "Fox spirit, 500 years old, adult form; allergic to seriousness.", media: ["Fox Spirit Fever"], role: "MAIN" },
  { name: "Yuzuru Matsuda", desc: "27-year-old product manager with a talent for escalations.", media: ["Office Romance Protocol"], role: "MAIN" },
  { name: "Nao Serizawa", desc: "31-year-old rival PM; her Gantt charts are weapons-grade.", media: ["Office Romance Protocol"], role: "MAIN" },
  { name: "Chihiro Amano", desc: "Night librarian, 26; guards the restricted shelf.", media: ["Midnight Library of Desires"], role: "MAIN" },
  { name: "Rin Kobayakawa", desc: "Sento's youngest owner at 30; inherited the boiler and the secrets.", media: ["Bathhouse Encounters"], role: "MAIN" },
  { name: "Lady Eveline", desc: "Summoned demon lord, appears mid-30s; obsessed with paperwork.", media: ["Demon Lord's Bride"], role: "MAIN" },
  { name: "Yuna Seo", desc: "27-year-old night paralegal with an iron constitution.", media: ["My Boss Is a Vampire"], role: "MAIN" },
  { name: "Doyun Han", desc: "Managing partner, 34, excellent dental benefits.", media: ["My Boss Is a Vampire"], role: "MAIN" },
  { name: "Zeo", desc: "Tower climber, 29; wants one honest answer per hundred floors.", media: ["Tower of Desire"], role: "MAIN" },
  { name: "Hayan", desc: "Floor 47 gatekeeper, unknown age, adult; trades riddles for truths.", media: ["Tower of Desire"], role: "SUPPORTING" },
  { name: "Minji Kwon", desc: "29-year-old secretary with two calendars and one white lie.", media: ["Double Life Secretary"], role: "MAIN" },
  { name: "Dr. Iseul", desc: "Night-shift resident, 31; runs on coffee and stubbornness.", media: ["Bedside Manner"], role: "MAIN" },
  { name: "Haru Myeong", desc: "Innkeeper, 36; the hot springs never miss a confession.", media: ["Innkeeper Chronicles"], role: "MAIN" },
  { name: "Selene", desc: "Moonlit Kingdom's treaty-sealing queen, 30.", media: ["Moonlit Kingdom"], role: "MAIN" },
  { name: "Warden Nyx", desc: "Dungeon overseer, adult; files paperwork for every creature.", media: ["Dungeon Breeders"], role: "MAIN" },
];

const PEOPLE = [
  { name: "Studio Kagami", kind: "STUDIO", bio: "Demo animation studio for the platform's fictional anime catalog." },
  { name: "Kurenai Works", kind: "STUDIO", bio: "Demo studio specializing in fantasy OVAs." },
  { name: "Velvet Rose Productions", kind: "STUDIO", bio: "Fictional AV studio; in this demo, scenes are represented by local sample streams." },
  { name: "Aozora Films", kind: "STUDIO", bio: "Fictional location-shooting AV studio." },
  { name: "Ruby House", kind: "STUDIO", bio: "Fictional interview-format studio." },
  { name: "Team Umbra", kind: "DEVELOPER", bio: "Fictional indie game collective." },
  { name: "Pixelmage Games", kind: "DEVELOPER", bio: "Fictional two-person game studio." },
  { name: "Studio Neonvice", kind: "DEVELOPER", bio: "Fictional cyberpunk RPG studio." },
  { name: "Aoi Yamazaki", kind: "AUTHOR", bio: "Demo manga author; office romance specialist." },
  { name: "Mika Onoda", kind: "AUTHOR", bio: "Demo author of vignette-style seinen." },
  { name: "Hana Kim", kind: "AUTHOR", bio: "Demo webtoon writer; supernatural office comedies." },
  { name: "Joon Park", kind: "ARTIST", bio: "Demo webtoon artist; full-color fantasy." },
  { name: "Sena Cho", kind: "ARTIST", bio: "Demo artist; crisp lineart, warm palettes." },
  { name: "Kuroneko-sensei", kind: "ARTIST", bio: "Demo illustrator; ink and watercolor pin-ups." },
  { name: "Erika Vance", kind: "ARTIST", bio: "Demo illustrator; baroque digital portraiture." },
  { name: "Pixelmage", kind: "ARTIST", bio: "Demo illustrator; neon cyberpunk sets." },
  { name: "Director Ken Arata", kind: "DIRECTOR", bio: "Demo anime director." },
  { name: "Director Mio Sagara", kind: "DIRECTOR", bio: "Demo AV anthology director (fictional)." },
];

const GENRES = [
  "Ecchi", "Romance", "Comedy", "Drama", "Fantasy", "Sci-Fi", "Action", "Harem",
  "Supernatural", "Mystery", "Slice of Life", "Historical", "Office", "Couples",
  "Anthology", "Visual Novel", "RPG", "Roguelite", "Sandbox", "Simulation",
  "Management", "Cyberpunk", "Illustration", "Guide", "Safety", "Privacy",
  "Reference", "Software", "Tracking", "Browsing", "Playback", "Wellbeing",
  "Experimental", "Documentary", "Dungeon Crawler",
];
const EXTRA_TAGS = [
  "Adult Cast", "Adult (18+)", "Full Color", "Verified performers", "Studio",
  "Original", "Slow Burn", "Rivals to Lovers", "Office", "Nightlife", "Youkai",
  "Library", "Bathhouse", "Hot Springs", "Matsuri", "Cyberpunk", "Neon",
  "Ukiyo-e", "Shunga homage", "Pin-up", "Watercolor", "Baroque", "Mecha",
  "Deity", "Couple", "Space", "First Contact", "Tower", "Vampire", "Hospital",
  "Inn", "Contract", "Marriage of Convenience", "Summoning", "Share House",
  "Workplace", "Academy", "Fencing", "Jazz Bar", "Art World", "Shrine",
  "Court Intrigue", "Investigation", "Remaster", "Sync", "QoL", "Player",
  "Stats", "Wellbeing", "Directory", "Community", "Downloads", "Open source",
  "VPN", "Dictionary", "Tags", "Curated", "Multi-artist", "Location",
  "Experimental", "Interview", "Anthology", "Cozy", "Base building",
  "Hand-painted", "Choices matter", "Management", "Dungeon", "Sandbox",
];

// ─────────────────────────── main ───────────────────────────
async function main() {
  console.log("Seeding Yozora…");

  // wipe (order matters for FKs)
  await db.galleryFavorite.deleteMany();
  await db.download.deleteMany();
  await db.scriptInstall.deleteMany();
  await db.notification.deleteMany();
  await db.report.deleteMany();
  await db.review.deleteMany();
  await db.collectionItem.deleteMany();
  await db.collection.deleteMany();
  await db.historyEntry.deleteMany();
  await db.progress.deleteMany();
  await db.libraryEntry.deleteMany();
  await db.chapterPage.deleteMany();
  await db.chapter.deleteMany();
  await db.episode.deleteMany();
  await db.galleryImage.deleteMany();
  await db.mediaCharacter.deleteMany();
  await db.mediaPerson.deleteMany();
  await db.providerLink.deleteMany();
  await db.media.deleteMany();
  await db.catalogItem.deleteMany();
  await db.provider.deleteMany();
  await db.character.deleteMany();
  await db.person.deleteMany();
  await db.tagDef.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();

  // tags
  const tagMap = new Map<string, string>();
  for (const g of GENRES) tagMap.set(g, "GENRE");
  for (const t of EXTRA_TAGS) if (!tagMap.has(t)) tagMap.set(t, "TAG");
  await db.tagDef.createMany({
    data: [...tagMap.entries()].map(([name, kind]) => ({ name, kind })),
  });

  // characters & people
  const charRows = new Map<string, string>();
  for (const c of CHARACTERS) {
    const row = await db.character.create({
      data: {
        name: c.name,
        description: c.desc,
        imageUrl: avatarUrl(`char-${c.name}`, c.name.slice(0, 1)),
      },
    });
    charRows.set(c.name, row.id);
  }
  const personRows = new Map<string, string>();
  for (const p of PEOPLE) {
    const row = await db.person.create({
      data: { name: p.name, kind: p.kind, bio: p.bio },
    });
    personRows.set(p.name, row.id);
  }

  const usedSlugs = new Set<string>();
  const mediaByTitle = new Map<string, string>(); // titleKey -> mediaId
  const createdMedia: { id: string; title: string; category: string }[] = [];

  for (const prov of PROVIDERS) {
    const provider = await db.provider.create({
      data: {
        id: prov.id, name: prov.name, category: prov.category,
        description: prov.description, version: prov.version, author: prov.author,
        homepage: prov.homepage,
        capabilities: A(prov.capabilities),
        configSchema: A(prov.configSchema),
        config: prov.configSchema.some((c) => c.required) ? null : A({}),
        status: prov.installed ? "ACTIVE" : "DISABLED",
        installed: prov.installed,
      },
    });

    for (const item of prov.items) {
      const key = normalizeTitle(item.title);
      const accent = accentFor(prov.category, key);
      const imported = item.imported === false ? false : !mediaByTitle.has(key) || true; // import everything unless explicitly false
      const doImport = item.imported !== false;

      const catalog = await db.catalogItem.create({
        data: {
          providerId: prov.id,
          externalId: slugify(item.title) + "-" + prov.id,
          title: item.title, titleKey: key,
          altTitles: A(item.alt ?? []),
          description: item.desc,
          coverUrl: coverUrl(`${key}-${prov.id}`, item.title, accent[0], prov.category),
          bannerUrl: bannerUrl(`${key}-${prov.id}`, item.title, accent[0]),
          accent: accent[0],
          category: prov.category,
          format: item.format, status: item.status, year: item.year,
          score: popScore(Math.random),
          popularity: 800 + Math.floor(Math.random() * 40000),
          genres: A(item.genres), tags: A(item.tags),
          studio: item.studio, creator: item.creator,
          ageRating: "18+",
          contentFlags: prov.category === "AV" ? FLAG_AV : FLAG_MEDIA,
          externalUrl: item.externalUrl ?? `https://example.org/${prov.id}/${slugify(item.title)}`,
          extra: A(item.extra ?? {}),
          episodesCount: item.eps ?? item.scenes ?? null,
          chaptersCount: item.chs ?? null,
          galleryCount: item.images ?? null,
          imported: doImport,
        },
      });

      if (!doImport) continue;

      // unified media (dedup: if another provider already created it, link instead)
      let mediaId = mediaByTitle.get(key);
      if (!mediaId) {
        let slug = slugify(item.title);
        let n = 2;
        while (usedSlugs.has(slug)) slug = `${slugify(item.title)}-${n++}`;
        usedSlugs.add(slug);
        const rating = popScore(Math.random);
        const row = await db.media.create({
          data: {
            slug, title: item.title, titleKey: key,
            altTitles: A(item.alt ?? []),
            description: item.desc,
            coverUrl: coverUrl(slug, item.title, accent[0], prov.category),
            bannerUrl: bannerUrl(slug, item.title, accent[0]),
            accent: accent[0], accent2: accent[1],
            category: prov.category,
            format: item.format, status: item.status, year: item.year,
            rating, ratingCount: 80 + Math.floor(Math.random() * 9000),
            popularity: 1000 + Math.floor(Math.random() * 50000),
            genres: A(item.genres), tags: A(item.tags),
            studio: item.studio, creator: item.creator,
            ageRating: "18+",
            contentFlags: prov.category === "AV" ? FLAG_AV : FLAG_MEDIA,
            externalLinks: A([
              ...(item.externalUrl ? [{ label: "Official resource", url: item.externalUrl }] : []),
              { label: `${prov.name} listing`, url: `https://example.org/${prov.id}/${slugify(item.title)}` },
            ]),
            extra: A(item.extra ?? {}),
          },
        });
        mediaId = row.id;
        mediaByTitle.set(key, row.id);
        createdMedia.push({ id: row.id, title: item.title, category: prov.category });

        // content units
        const plan = planUnits(prov.category, key, {
          episodes: item.eps, chapters: item.chs, scenes: item.scenes, images: item.images,
        });

        if (prov.category === "ANIME" || prov.category === "AV") {
          for (const ep of plan.episodes) {
            const hasDemoStream = item.title === "Tokyo Nights Vol. 4" && ep.number === 1;
            await db.episode.create({
              data: {
                mediaId: row.id, number: ep.number, title: ep.title,
                durationSec: ep.durationSec,
                thumbnailUrl: thumbUrl(`${key}-ep${ep.number}`, `EP ${ep.number}`, accent[0]),
                streamUrl: hasDemoStream ? "/media/demo-stream.mp4" : null,
                streamType: hasDemoStream ? "mp4" : "none",
                summary: ep.summary,
                releasedAt: new Date(item.year, (ep.number - 1) % 12, 7),
              },
            });
          }
        }

        if (prov.category === "MANGA" || prov.category === "MANHWA") {
          for (const ch of plan.chapters) {
            const chapter = await db.chapter.create({
              data: {
                mediaId: row.id, number: ch.number, title: ch.title,
                pageCount: ch.pageCount,
                releasedAt: new Date(item.year, Math.floor((ch.number - 1) / 4) % 12, ((ch.number * 3) % 27) + 1),
              },
            });
            for (let i = 0; i < ch.pageCount; i++) {
              await db.chapterPage.create({
                data: {
                  chapterId: chapter.id, idx: i,
                  imageUrl: pageUrl(`${key}-c${ch.number}-p${i}`, `Ch. ${ch.number} · ${i + 1}/${ch.pageCount}`),
                },
              });
            }
          }
        }

        if (prov.category === "ILLUSTRATION") {
          for (let i = 0; i < plan.galleryImages; i++) {
            await db.galleryImage.create({
              data: {
                mediaId: row.id, idx: i,
                imageUrl: galleryUrl(`${key}-g${i}`, accent[0]),
                thumbUrl: galleryUrl(`${key}-g${i}`, accent[0], 480, 700),
                tags: A([DeterministicTag(i), ...item.tags.slice(0, 2)]),
                favCount: Math.floor(Math.random() * 900),
              },
            });
          }
        }
      }

      // provider link (dedup path also lands here)
      await db.providerLink.create({
        data: {
          mediaId,
          providerId: prov.id,
          externalId: catalog.externalId,
          externalUrl: catalog.externalUrl,
        },
      });

      // characters ↔ media
      for (const c of CHARACTERS) {
        if (c.media.includes(item.title)) {
          await db.mediaCharacter.create({
            data: { mediaId, characterId: charRows.get(c.name)!, role: c.role },
          }).catch(() => {});
        }
      }
      // people ↔ media
      const personLinks: [string, string][] = [];
      if (item.studio) personLinks.push([item.studio, "STUDIO"]);
      if (item.creator) {
        const kind = prov.category === "ANIME" ? "DIRECTOR" : prov.category === "GAME" ? "DEVELOPER" : prov.category === "ILLUSTRATION" ? "ARTIST" : "AUTHOR";
        personLinks.push([item.creator, kind]);
      }
      for (const [name, role] of personLinks) {
        const pid = personRows.get(name);
        if (pid) {
          await db.mediaPerson.create({
            data: { mediaId, personId: pid, role },
          }).catch(() => {});
        }
      }
    }
  }

  // tag counts
  const allMedia = await db.media.findMany({ select: { genres: true, tags: true } });
  const counts = new Map<string, number>();
  for (const m of allMedia) {
    for (const t of [...JSON.parse(m.genres), ...JSON.parse(m.tags)]) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  for (const [name, count] of counts) {
    await db.tagDef.updateMany({ where: { name }, data: { count } });
  }

  // ── demo users ──
  const crypto = await import("node:crypto");
  const hash = (pw: string) => {
    const salt = crypto.randomBytes(16).toString("hex");
    const h = crypto.scryptSync(pw, salt, 64).toString("hex");
    return `${salt}:${h}`;
  };

  const demo = await db.user.create({
    data: {
      username: "demo",
      displayName: "Demo Reader",
      bio: "Just here for the night shift. 25-year-old demo account — all library data is fictional.",
      avatarUrl: avatarUrl("demo", "D"),
      passwordHash: hash("demo1234"),
      ageVerifiedAt: new Date(),
      isDemo: true,
      settings: A({ readerMode: "webtoon", fitWidth: true, hiddenCategories: [] }),
    },
  });
  const kuro = await db.user.create({
    data: {
      username: "kuro_fan",
      displayName: "Kuro Fan",
      bio: "Fox spirit enthusiast. 29.",
      avatarUrl: avatarUrl("kuro_fan", "K"),
      passwordHash: hash("kuro1234"),
      ageVerifiedAt: new Date(),
    },
  });

  const byTitle = new Map(createdMedia.map((m) => [m.title, m.id]));
  const lib = (title: string, status: string, progress: number, score?: number, favorite = false) => {
    const mediaId = byTitle.get(title);
    if (!mediaId) return null;
    return db.libraryEntry.create({ data: { userId: demo.id, mediaId, status, progress, score, favorite } });
  };
  await lib("Sakura Nightfall", "IN_PROGRESS", 7, 9, true);
  await lib("My Boss Is a Vampire", "IN_PROGRESS", 14, 8, true);
  await lib("Kuroneko-sensei Art Pack Vol. 3", "COMPLETED", 24, 9, true);
  await lib("Tokyo Nights Vol. 4", "IN_PROGRESS", 2, 7);
  await lib("Moonlit Kingdom", "PLANNING", 0, undefined, false);
  await lib("Office Romance Protocol", "IN_PROGRESS", 9, 8);
  await lib("Harem Dormitory!!", "COMPLETED", 12, 7, true);
  await lib("Innkeeper Chronicles", "PAUSED", 6);

  // progress rows
  const sakura = await db.media.findFirst({ where: { titleKey: normalizeTitle("Sakura Nightfall") }, include: { episodes: true } });
  if (sakura) {
    for (const ep of sakura.episodes.slice(0, 6)) {
      await db.progress.create({
        data: { userId: demo.id, mediaId: sakura.id, itemId: ep.id, kind: "EPISODE", completed: true },
      });
    }
  }
  const boss = await db.media.findFirst({ where: { titleKey: normalizeTitle("My Boss Is a Vampire") }, include: { chapters: { orderBy: { number: "asc" } } } });
  if (boss) {
    for (const ch of boss.chapters.slice(0, 14)) {
      await db.progress.create({
        data: { userId: demo.id, mediaId: boss.id, itemId: ch.id, kind: "CHAPTER", pageIndex: ch.pageCount - 1, completed: true },
      });
    }
  }

  // history
  const hist: [string, string, string][] = [
    ["VIEW", "Sakura Nightfall", "ANIME"],
    ["WATCH", "Sakura Nightfall", "ANIME"],
    ["READ", "My Boss Is a Vampire", "MANHWA"],
    ["VIEW", "Kuroneko-sensei Art Pack Vol. 3", "ILLUSTRATION"],
    ["WATCH", "Tokyo Nights Vol. 4", "AV"],
    ["VIEW", "Moonlit Kingdom", "GAME"],
    ["READ", "Office Romance Protocol", "MANGA"],
    ["SEARCH", null, "MANGA"],
    ["VIEW", "Harem Dormitory!!", "ANIME"],
    ["BROWSE", null, "ILLUSTRATION"],
  ];
  for (let i = 0; i < hist.length; i++) {
    const [action, title, category] = hist[i];
    const mediaId = title ? byTitle.get(title) : null;
    await db.historyEntry.create({
      data: {
        userId: demo.id, mediaId, category, action,
        titleSnapshot: title ?? (action === "SEARCH" ? "fox spirit" : null),
        coverSnapshot: title ? `/api/placeholder?type=thumb&seed=${encodeURIComponent(title)}&label=&accent=%233DB4F2&w=80&h=80` : null,
        createdAt: new Date(Date.now() - (i + 1) * 3600_000 * 7),
      },
    });
  }

  // collections
  const col1 = await db.collection.create({
    data: { userId: demo.id, name: "Late Night Reads", description: "Webtoons and manga for the 1 a.m. shift." },
  });
  for (const t of ["My Boss Is a Vampire", "Office Romance Protocol", "Midnight Library of Desires", "Innkeeper Chronicles", "Tower of Desire"]) {
    const id = byTitle.get(t);
    if (id) await db.collectionItem.create({ data: { collectionId: col1.id, mediaId: id } });
  }
  const col2 = await db.collection.create({
    data: { userId: demo.id, name: "Comfort Ecchi", description: "Rewatch pile. Zero stakes, high charm." },
  });
  for (const t of ["Harem Dormitory!!", "Fox Spirit Fever", "Sunset Café Manager", "Summer Festival After Dark"]) {
    const id = byTitle.get(t);
    if (id) await db.collectionItem.create({ data: { collectionId: col2.id, mediaId: id } });
  }

  // reviews
  const reviews: [string, number, string, string, string][] = [
    ["Sakura Nightfall", 9, "Neon-perfect", "Gorgeous direction and an adult cast that behaves like adults. The night-district arcs are the best fantasy romance TV this year.", "demo"],
    ["My Boss Is a Vampire", 8, "Dental benefits", "Full-color webtoon with real comedic timing. Deducting one point for cliffhangers.", "kuro_fan"],
    ["Fox Spirit Fever", 8, "Fox approves", "500-year-old fox, 28-year-old bartender, zero rush. Slow burn done right.", "kuro_fan"],
  ];
  for (const [title, score, rTitle, body, who] of reviews) {
    const mediaId = byTitle.get(title);
    if (!mediaId) continue;
    await db.review.create({
      data: {
        mediaId, score, title: rTitle, body,
        userId: who === "demo" ? demo.id : kuro.id,
      },
    });
  }

  // notifications
  const notes: [string, string, string, string | null][] = [
    ["LIBRARY", "New chapter of Office Romance Protocol", "Chapter 15 just went up on InkScans.", "#/media/office-romance-protocol"],
    ["PROVIDER", "InkVault needs configuration", "The InkVault provider failed its health check: no mirror configured.", "#/extensions"],
    ["SUCCESS", "Download complete", "Chapter 14 — My Boss Is a Vampire is available offline.", "#/downloads"],
    ["LIBRARY", "New episode of Sakura Nightfall", "Episode 12 is now streaming on AoiStream.", "#/media/sakura-nightfall"],
    ["INFO", "Welcome to Yozora", "Your universal 18+ media platform. Start from the Home tab or install more providers.", "#/browse/ANIME"],
  ];
  for (let i = 0; i < notes.length; i++) {
    const [type, title, body, link] = notes[i];
    await db.notification.create({
      data: { userId: demo.id, type, title, body, link, createdAt: new Date(Date.now() - i * 5400_000) },
    });
  }

  const mediaCount = await db.media.count();
  const providerCount = await db.provider.count();
  const pages = await db.chapterPage.count();
  console.log(`Seed complete: ${providerCount} providers, ${mediaCount} media, ${pages} reader pages.`);
  console.log(`Demo account: username "demo" / password "demo1234"`);
}

// tiny helper (deterministic tag pick)
function DeterministicTag(i: number): string {
  const pool = ["Original", "Pin-up", "Full Color", "Neon", "Watercolor", "Adult (18+)", "Curated"];
  return pool[i % pool.length];
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
