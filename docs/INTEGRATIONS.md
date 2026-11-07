# Integration status — verified with real requests

Legend: **REAL** = verified working from this deployment's network ·
**GATED** = real endpoint, requires the user's own (free) credentials ·
**NOT INTEGRATED** = no adapter shipped, reason stated.

Audit command: `bun scripts/audit-providers.ts "<query>"` — pings + searches
every adapter below with live network calls.

## Anime
| Provider | Status | Integration | Evidence (2025) |
|---|---|---|---|
| AniList | REAL | Official public GraphQL (graphql.anilist.co, docs.anilist.co) | 20 hentai-genre popular hits; search correctly empty for non-adult queries |
| HentaiOcean | REAL + in-site playback | Documented public API (hentaiocean.com/api?action=hentai&slug=), site RSS for browse, site search, embed player resolved to the site's own direct MP4 mirror | details+genres per slug; RSS 765 items; stream verified 206 video/mp4 (155MB) and PLAYING in-app |
| NSFW-API (aggregator) | REAL (config) | github.com/Varomine/NSFW-API — self-hostable Bun/Hono wrapper (/api/{provider}/search/{q}, /api/{provider}/watch/{id}); default = repo's public Workers instance | Public instance upstreams dead (500/empty) as of 2026-11 → honest error; set baseUrl in provider config to your own deployment |
| AniDB | REMOVED (user directive) | — | "for anime not animedb it has no stream" — anime is now served by streaming sources (HentaiOcean, NSFW-API) + AniList metadata + Sukebei torrents |
| Sukebei Nyaa (anime/manga) | REAL | Public RSS (sukebei.nyaa.si/?page=rss) | 23/69 torrent hits for "fate"; magnet/torrent = external |

## Manga / Manhwa
| Provider | Status | Integration | Evidence |
|---|---|---|---|
| MangaDex | REAL + IN-SITE READING | Official public API (api.mangadex.org/docs), contentRating=erotica,pornographic; chapters via sanctioned at-home server | search 24 hits; units→17 real page URLs (200 image/jpeg); TTL re-resolution handles at-home expiry |
| nhentai | REAL + in-app reading | OFFICIAL public JSON API v2 (nhentai.net/api/v2): /galleries?query=&page=, /galleries/popular, /galleries/{id}, /cdn image servers; flat list fields (english_title/thumbnail) vs nested detail shape | search 24 hits w/ covers; gallery 694781 → 63 pages, page verified 200 image/webp, READS in-app |
| MangaUpdates | REAL | Official public API (api.mangaupdates.com/v1/info) | 25 hits for "fate"; details endpoint live. No browse (API requires ≥1 char — honest 400) |
| E-Hentai | REAL | Public HTML search + official api.php gdata | 25 hits; viewer-page lazy resolution |
| Manga18fx | REAL | Public site integration (chapter pages resolved at read) | 6 hits for "fate" |
| WholesomeList | REAL | Public JSON API (wholesomelist.com) | 3996-entry list with per-entry nhentai/e-hentai links |

## Illustrations
| Provider | Status | Integration | Evidence |
|---|---|---|---|
| e621 | REAL | Official documented REST (e621.net/help:api) via curl transport (TLS fingerprinting) | 2 search hits, 35 popular |
| yande.re | REAL | Moebooru public post.json | 1 hit for "fate" (exact-tag semantics verified), 33 popular |
| Hypnohub | REAL | Gelbooru-0.2 dapi JSON | 40 popular; zero-result = 0-byte body handled (verified upstream) |
| Gelbooru | GATED | dapi JSON — needs user's free API key | upstream 401 without key (endpoint proven) |
| Danbooru | NOT INTEGRATED (temporary) | API exists but site was down ("Downbooru") during both verification attempts — adapter withheld until verifiable, per no-unverified-code rule |

## AV / JAV / PMV / HMV / Creator / Hentai video
TAXONOMY (user-corrected 2026-11): **AV and JAV are the same category** — "AV" IS Japanese Adult Video.
The distinct slices that remain: WESTERN studio scenes, CREATOR clips, PMV/HMV edits, HENTAI animation.
USER DIRECTIVE (2026-11): **PMV = PMVHaven ONLY; HMV = HMVmania + Iwara ONLY.** EPorner and PMV Stash stay in the general AV pool but are scoped out of the dedicated PMV tab.
| Provider | Status | Integration | Evidence |
|---|---|---|---|
| JavDB | REAL | Public HTML search/detail pages (javdb.com), curl-resilient transport + politeness limiter (robots crawl-delay respected; user-initiated, cached) | 20 results for "SSIS-700" with codes/covers/magnets; detail page parsed (cast, studio, magnet) |
| r18.dev | REAL | Public CC0 JSON API (r18.dev/videos/vod/movies/detail/-/dvd_id=<CODE>/json); exact-code lookups + OFFICIAL trailer MP4 (DMM public CDN) | MIDE-500 → full metadata 200 + trailer mp4 stream verified in-app |
| XVideos | REAL + in-site playback | Public HTML search + html5player variables (setVideoUrlHigh/setVideoHLS) resolved fresh per request; signed URLs never cached long | 24 search hits "jav"; direct mp4 stream proxied 206 video/mp4 |
| EPorner | REAL + in-site playback | OFFICIAL public JSON API (eporner.com/api/v2, no key) + site's own player XHR (hash → base36 calc → sources.mp4) | 24 PMV hits; top-weekly id → direct 2160p/720p mp4 (206 in-app); brand-new uploads honestly rejected during processing window |
| PMVHaven | REAL + in-site playback | Public keyless browse API (/api/videos?tags=&sort=&page=) with DIRECT MP4s on its OVH storage; text search needs a platform key upstream → honestly absent | 24 PMV hits; direct 206 video/mp4 playback verified in-app (1280p) |
| HMVmania | REAL + in-site playback | Dedicated HMV community site (hmvmania.com): /2d-videos/ index (paged), per-video pages expose the site's own WP-hosted MP4 (data-video-source); WP site search does NOT index video posts → search honestly absent | 40 cards page 1; stream verified 206 video/mp4 (42MB) and PLAYING in-app |
| Iwara | REAL + in-site playback | api.iwara.tv keyless guest API (browser UA + Referer required): /videos?limit=&page=&sort= (0-based), /video/{id} → fileUrl (signed JSON variants) → asta.iwara.tv stream; guest search ignored upstream → honestly absent | 24 hits page 1; stream verified 206 video/mp4 and PLAYING in-app |
| Hanime1 | REAL + in-site playback | Public HTML search/watch pages (hanime1.me), curl-resilient transport; site's own signed MP4s resolved fresh | 40 hits; watch page → vdownload.hembed.com 720p mp4 verified in-app |
| Rule34Video | REAL + in-site playback | Public KVS site; MP4 URLs the player itself exposes (flashvars); curl-resilient transport + 45s token freshness; /api/img retries with fresh cookies then streams via curl | 23-24 search hits; direct stream 206 video/mp4 — the previously-crashing expired-token case now plays (verified in browser) |
| StashDB | GATED (WESTERN) | stash-box GraphQL (stashdb.org/graphql), ApiKey header — NO public no-key path exists upstream (verified) | endpoint answers GraphQL; every read "not authorized" without key (verified) |
| JAVStash | GATED (JAV) | same protocol, javstash.org | same evidence |
| FansDB | GATED (CREATOR) | same protocol, fansdb.cc | same evidence |
| PMV Stash | GATED (PMV) | same protocol, pmvstash.org | same evidence |
| ThePornDB | NOT INTEGRATED | api.theporndb.net behind Cloudflare challenge for datacenter IPs; endpoint shape unverifiable from sandbox — no adapter shipped rather than guess |
| JavBus / JavLibrary / MissAV | NOT INTEGRATED | Cloudflare/ddos-guard challenge pages from this network on every transport — no adapter shipped (no fakes) |

## Games / Scripts / Misc
| Provider | Status | Integration | Evidence |
|---|---|---|---|
| VNDB | REAL | Official kana API (api.vndb.org/kana) | 30 hits for "fate" |
| DLsite | REAL | Public product AJAX endpoint | 24 hits, real RJ ids |
| Wotaku (scripts/misc/databases) | REAL | Open-source wiki repo data (github.com/wotaku-dev) | real directory entries with official URLs |

## Metadata sync
- `src/lib/sync.ts` + `src/instrumentation.ts`: in-process scheduler
  (boot+60s, then every 6h). Jobs: provider health (real pings),
  AniDB↔catalog crosswalk (title-normalized ProviderLink mapping).
- Manual trigger: `POST /api/sync/run {job:"health"|"crosswalk"|"all"}`.
- Every run is logged to the `SyncLog` table (reviewers: query it).
- Dedup: unified `Media.titleKey` + `ProviderLink @@unique(providerId, externalId)`.
