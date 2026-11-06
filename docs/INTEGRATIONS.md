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
| AniDB | REAL (titles+crosswalk) | Public titles dump anidb.net/api/anime-titles.xml.gz (wiki.anidb.net HTTP API def) | 24 title hits for "fate"; crosswalk mapped 10/10 AniList-linked anime (e.g. "Kite"→anidb 314). Full AniDB metadata API NOT integrated (requires registered client) |
| Sukebei Nyaa (anime/manga) | REAL | Public RSS (sukebei.nyaa.si/?page=rss) | 23/69 torrent hits for "fate"; magnet/torrent = external |

## Manga / Manhwa
| Provider | Status | Integration | Evidence |
|---|---|---|---|
| MangaDex | REAL + IN-SITE READING | Official public API (api.mangadex.org/docs), contentRating=erotica,pornographic; chapters via sanctioned at-home server | search 24 hits; units→17 real page URLs (200 image/jpeg); TTL re-resolution handles at-home expiry |
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

## AV / JAV / PMV / Creator video (metadata)
Subcategories stay DISTINCT (AV / JAV / PMV / HMV / CREATOR) — never merged into Anime.
| Provider | Status | Integration | Evidence |
|---|---|---|---|
| StashDB | GATED | stash-box GraphQL (stashdb.org/graphql, docs.stashapp.cc), ApiKey header | endpoint answers GraphQL; every read "not authorized" without key (verified) |
| JAVStash | GATED | same protocol, javstash.org | same evidence |
| FansDB | GATED | same protocol, fansdb.cc | same evidence |
| PMV Stash | GATED | same protocol, pmvstash.org | same evidence |
| ThePornDB | NOT INTEGRATED | api.theporndb.net behind Cloudflare challenge for datacenter IPs; endpoint shape unverifiable from sandbox — no adapter shipped rather than guess |
| JAVInfo | NOT INTEGRATED | no documented public API verifiable from sandbox (site 200) |
| Rule34Video | REAL + in-site playback | Public KVS site; MP4 URLs the player itself exposes (flashvars); no auth/DRM bypassed | 24 search hits; direct streams proxied with Range support |

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
