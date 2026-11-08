# Yozora — Current-State Audit

**Date:** 2026-11-08 · **Commit:** `87bf4e9` (main) · **Method:** source inspection + live execution
(provider audit harness, browser E2E via agent-browser, direct upstream probes).
Every status below carries its evidence. Statuses: **REAL** (verified by execution) ·
**PARTIAL** (works but requirements missing) · **DEMO** (simulated) · **BROKEN** ·
**NOT IMPLEMENTED** · **BLOCKED** (reason stated).

Re-run the audit at any time: `bun scripts/audit-providers.ts "query"` and the browser
checks in `todo.md`.

---

## 0. Pivot audit (2026-11-08, session C) — seanime track

| Item | Status | Evidence |
|---|---|---|
| Fork `librewolfsigma/yozora` of 5rahim/seanime | **REAL** | GitHub API: `fork: true`, parent set, full size 579570 KB, GPL-3.0 |
| Stale Next.js mirror renamed `yozora-legacy` (+ local mirror backup) | **REAL** | API 200 on renamed repo; `~/work/yozora-legacy-backup.git` cloned |
| Extension contract extraction (manga + onlinestream providers) | **REAL** | Read from fork source: `internal/extension_repo/goja_manga_provider.go`, `goja_onlinestream_provider.go`, `goja_base.go` (`new Provider()`), `goja_plugin_types/core.d.ts` (fetch/Doc/Crypto/$store), `hibike/{manga,onlinestream}/types.go` |
| 5 provider extensions published (`yozora-extensions` @ `4a8bc69`) | **REAL** | All 10 raw.githubusercontent runtime URLs → HTTP 200 |
| Providers work against live upstreams | **REAL** | Harness 40/40: nhentai search 24 results + cover `image/webp` + pages == gallery `num_pages`; hentaiocean search→episodes→`w2.hentaiocean.com` MP4 `206 video/mp4`; iwara variants resolution `206 video/mp4` (guest search refusal re-verified: `search=` returns identical listing); pmvhaven tag browse → OVH MP4 `206`; hmvmania slug → wp-content MP4 `206` |
| Install path (what seanime does at install time) | **REAL** | install-sim: `repo.json` → 5 manifests → payload fetch → TS transpile → `new Provider()` → `getSettings()` — all green, marketplace cross-consistent |
| Extensions load inside a real seanime binary | **REAL** (search surfaces) / **BLOCKED** (playback chain) | Go installed from tarball → fork built (`/tmp/seanime-test`, 65 MB) → server headless on :43211 → install-repository API loaded **5/5 extensions, 0 invalid**; real searches through the server: hentaiocean 20 · pmvhaven ok · hmvmania `[]` · iwara honest refusal · nhentai 24 with covers. Playback chain needs a real AniList login (server runs with SIMULATED token + empty collection) |
| Iwara keyless search | **NOT IMPLEMENTED (by upstream)** | Guest API ignores `search` (nonsense query returns identical listing) — extension refuses honestly |
| HMVmania keyless search | **NOT IMPLEMENTED (by upstream)** | WP search does not index video posts — extension returns `[]` honestly |
| PMVHaven keyless search | **PARTIAL** | Keyless = browse-by-tag (first query word); text search is key-gated upstream (`/api/search` → 401) |

## 0b. Pivot audit — session D (2026-11-08): hosting + recycle recovery

| Item | Status | Evidence |
|---|---|---|
| Product served at the preview URL | **REAL** | `e2e:` agent-browser on `https://preview-chat-79614d8d-…space-z.ai/`: page renders (title "Seanime"), zero page errors; `proxy.ts` rewrite header observed (`x-middleware-rewrite: http://127.0.0.1:43211/`) before boot; after boot both `:43211` root and proxied `:3000/` → HTTP 200 |
| Gateway WebSocket (`/events`) | **REAL** | Browser console: `WebSocket connection opened` on the preview origin; server status event received with correct dataDir; fork commit `33beaaf9` attaches `XTransformPort=43211` only for `*.space-z.ai` hosts |
| Sandbox-recycle rebuild | **REAL** | Recycle wiped `/home/z/yozora-runtime`, `/home/z/yozora-data`, Go toolchain → full rebuild: Go 1.27.3 tarball, fork clone to `vendor/yozora`, `npm ci` 827 pkgs, `rsbuild build` (11.3 MB), `go build` CGO_ENABLED=0 → 79.9 MB binary at `my-project/.yozora/runtime/` (all persisted) |
| Boot race fix | **REAL** | Stale pre-edit instrumentation keepalive shared the old boot-promise global → route returned `up:false` without spawning; fixed by versioning globals (`__yozoraSeanimeBootingV2`); `probe:` bridge-boot `{up:true,probed:true,binExists:true}` |
| Config (passwordless + origin allowlist) | **REAL** | `.yozora/data/config.toml`: `password=""`, `accessAllowlist=["*.space-z.ai", preview-origin]`, `trustedProxies=["127.0.0.1"]`, `externalURL=preview`; server accepted it (boot log clean) |
| Extension pack reinstalled on rebuilt server | **REAL** | `POST /api/v1/extensions/external/install-repository` (raw `repo.json` URL; API wants the direct manifest URL, not a repo slug) → 9 extensions listed: 5 providers + 3 custom-source + local-manga |
| Real searches on rebuilt binary | **REAL** | `/api/v1/onlinestream/search` hentaiocean → 20 results; iwara → honest refusal (full ported message); `/api/v1/manga/search` nhentai → 24 results. Note: body key is `provider`; privileged endpoints need a parseable trusted `Origin` header in passwordless mode |
| Playback chain | **BLOCKED** (unchanged) | Needs real AniList login — sandbox server runs with simulated token + empty collection |
| Fork CI gates | **NOT IMPLEMENTED** | Session D leftover: go vet/build/test + web build workflow on the fork |

## 0c. Pivot audit — session E (2026-11-08): the 403 root cause + fork-owned security fix

| Item | Status | Evidence |
| --- | --- | --- |
| User-reported wizard 403 (`this action requires either a server password or a trusted local origin`) | **ROOT-CAUSED** | Server log: `POST /api/v1/start status=403` ×3 at 18:53. Two upstream incoherencies in `internal/handlers/local_security.go` |
| Fix 1: allowlisted origin trusted for privileged actions | **REAL (fork commit `43f8ca1d`, pushed)** | Upstream let `server.accessAllowlist` cover only the passive API/events boundary, never the privileged guards. Fork adds `isTrustedRequestWithAllowlist` + `isStrictLocalBoundarySatisfied`, threaded through all 8 privileged guards + 4 strict guards. `test:` full handlers suite green, 7 new subtests |
| Fix 2: origin-less loopback (proxy-hop) requests trusted in default mode | **REAL (fork commit `cc774bb1`, pushed)** | Site proxy terminates the browser boundary locally (strips Origin) — upstream guards then denied every privileged write. Fork grants trust to origin-less requests from loopback clients with no untrusted forwarded hop; browsers always send Origin on cross-site writes so CSRF is unaffected; LAN-private clients keep upstream require-origin behavior (upstream `rejects missing origin` tests still green); hardened/strict unaffected. `test:` suite green, 6 new subtests |
| Pre-existing test-platform bug fixed | **REAL** | `TestUsesPrivilegedCommandSettings` hardcoded macOS VLC/qBittorrent paths → failed on Linux; now uses `defaultVLCPaths()[0]` / `defaultQBittorrentPaths()[0]` |
| Differential proof (live binary, real HTTP) | **REAL** | Direct-to-Go `POST /api/v1/extensions/external/install-repository` (invalid URI, `install:false`, no state change): preview origin → guard passes → 500 `failed to fetch extension manifest` (validation ran); `https://evil.example` → **403 guard error** (CSRF blocked); origin-less loopback → guard passes → 500 |
| Browser E2E — full setup journey | **REAL** | `e2e:` agent-browser through Caddy (same chain as preview): fresh wizard → library path `/home/z/my-project/download` → player/qbittorrent/debrid steps → features step (user's exact screenshot state) → **Launch Seanime → `POST /api/v1/start status=200`** (server log, 19:37 vs the 18:53 403s) → AniList login gate → skip → main app: Home/Schedule/Manga/My lists/Discover + trending carousels. Screenshots `upload/e2e-anilist-gate.png`, `upload/e2e-main-ui.png` |
| Content flow through full preview chain | **REAL** | `POST /api/v1/manga/search` nhentai via Caddy → Next proxy → Go → live results (titles + covers) |
| Deployment self-healing | **REAL** | Platform wipes `node_modules` + kills processes between sessions (project files persist). Cron watchdog job `515740` (every 5 min) re-installs deps and respawns Go (:43211) + Next (:3000) with single-instance probes |

---

## 1. Architecture

| Area | Status | Evidence |
|---|---|---|
| Client-not-database core | **REAL** | Schema has zero content tables (User, Session, Provider, ExtensionRepo, LibraryEntry, Progress, HistoryEntry, Collection, CollectionItem, Review, Report, Notification, ScriptInstall only — `prisma/schema.prisma`). Home/detail/search perform live upstream fetches; `grep create\|upsert` in `src/app/api/home/route.ts` returns nothing. |
| Bounded TTL caches only | **REAL** | `src/lib/cache.ts` (app-level) + `src/lib/providers/live/http.ts` (3-min LRU, CACHE_MAX=600, MAX_RESPONSE_BYTES 8MB with bounded readers). |
| Image/media proxy with SSRF guard | **REAL** | `/api/img`: strict host allowlist + **manual redirect loop with per-hop re-validation** (`RedirectBlockedError`, 5 hops max) + curl final-destination validation before `-L` transports. Probe to link-local metadata IP returns 403. |
| Provider credentials never cross HTTP | **REAL** | `toPublicProvider()` strips `config` from every `/api/providers` response (installed + repository). Probed by setting a real secret then scanning all responses — zero leakage. |
| Health-status honesty | **REAL** | Key-gated providers report `UNCONFIGURED` (not ERROR); failure notifications fire only for real upstream failures (`healthCheck` in engine). |

## 2. Provider ecosystem (35 registered)

Audit harness (2026-11-08, query "hentai"): **29 OK / 5 config-gated / 1 honest fail / 35**.

| Slice | Providers | Status | Evidence |
|---|---|---|---|
| Anime streaming | HentaiOcean | **REAL** | RSS browse (765 items) + documented slug API + embed→direct MP4; **206 video/mp4 verified, playing in-app** (readyState 4, time advancing). |
| Anime streaming (agg.) | NSFW-API | **BLOCKED (upstream)** | Adapter real; repo's public instances' upstreams dead (500/empty). `baseUrl` config for self-host; failures surface honestly. |
| Anime metadata | AniList | **REAL** | Official GraphQL, adult scope; audit 20 hits. |
| Anime torrents | Sukebei Nyaa | **REAL** | RSS; external magnets only. |
| Manga | MangaDex, nhentai v2 | **REAL** | MangaDex at-home reading; nhentai JSON v2 — gallery 694781 → 63 pages, 200 image/webp, **reads in-app**. |
| Doujin | E-Hentai, WholesomeList, Sukebei, HentaiFox (extension) | **REAL** | audit: 25 / 3996 / 75 / 17 hits; E-Hentai + HentaiFox read in-app. |
| Manhwa | Manga18fx | **REAL** | audit 24 hits; chapter/page resolution via site pages. |
| AV/JAV | JavDB, r18.dev, XVideos | **REAL** | code search + trailer/direct MP4 playback (206 verified). |
| PMV | PMVHaven (exclusive per directive) | **REAL** | keyless browse API, direct MP4 (206). |
| HMV | HMVmania + Iwara (exclusive per directive) | **REAL** | HMVmania data-video-source MP4 (206, playing in-app); Iwara guest API → signed variants → 206, playing in-app. Both honestly search-less (upstream limitation, verified). |
| Western/Creator/PMV metadata | StashDB, FansDB, JAVStash, PMV Stash | **BLOCKED (credentials)** | Official stash-box GraphQL; free-key gated; honest UNCONFIGURED state. |
| Illustrations | e621, yande.re, Hypnohub, (Gelbooru gated) | **REAL** | Booru UI (tag search, masonry, lightbox); Gelbooru 401 without keys = honest gate. |
| Collections | e621 Pools | **REAL** | audit 24 pools. |
| Games | VNDB, DLsite | **REAL** | metadata + official store links only (by design — no piracy). |
| Databases/Scripts/Misc | Wotaku ×3 | **REAL** | live directory fetches. |
| Extension repo | librewolfsigma/yozora-extensions | **REAL** | manifest sync → declarative recipe adapters (HentaiFox), 6h auto-refresh, last-good cache, sync-state UI. |

## 3. User journeys (browser-verified 2026-11-07/08)

| Journey | Status | Evidence |
|---|---|---|
| First launch → age gate → home | **REAL** | agent-browser walkthrough; gate persists via localStorage `yozora_age`. |
| Browse sources → open source → infinite scroll | **REAL** | 35-source directory; source pages page upstream N for real (`providerBrowse`); ILLUSTRATION feed auto-fetched pages 1→2 via sentinel. |
| Read manga (nhentai) | **REAL** | detail → Read now → reader shows site pages; lazy image loading verified. |
| Watch anime (HentaiOcean) / HMV (Iwara, HMVmania) / PMV (PMVHaven) | **REAL** | `readyState=4`, currentTime advancing on all four sources. |
| Mid-stream recovery | **REAL** | error/stall → toast → `fresh=1` re-resolve → player remount (observed live during a 403 window; recovery loop fired and succeeded after allowlist fix). |
| Metadata partial-failure resilience | **REAL** | `getWork` returns identity+units on details failure with warning banner instead of 502. |
| Search across providers | **PARTIAL** | registry-driven fan-out with per-provider isolation; **no per-source timeout knob in UI, no source-selection UI yet, results not grouped by source in the list UI.** |
| Library / progress / history / collections persistence | **REAL** | Prisma-backed rows; continue-watching deep links verified. |
| Offline downloads | **NOT IMPLEMENTED** | No download manager; "downloads" are external magnets/official links only. |
| Reader/Player settings (layouts, speed) | **PARTIAL** | Basic chrome exists; no layout modes, speed control not surfaced everywhere. |
| Recommendations | **PARTIAL** | Per-provider "popular" rails + category trending; **no personalization signals** (favorites/history-based) yet; per-section isolation respected (no cross-category mixing). |
| Extension management | **PARTIAL** | Install/uninstall/configure/health/sync real; **no per-extension update-check UI, no version-compat gate**. |
| Password login (single local user) | **NOT IMPLEMENTED** | scrypt+session lib exists (`src/lib/auth.ts`) but no password routes; app is cookie-profile auto-created. **Decision needed** — conflicts with earlier "no login anywhere" directive; master vision §18 requests local password. |
| Tauri/Windows desktop | **NOT IMPLEMENTED** | Web app only. |
| Automated tests | **PARTIAL** | CI gates (eslint, tsc --noEmit, gitleaks, semgrep, CodeQL via master-ci) + audit harness; **unit/integration/e2e suites absent** (being added — see todo.md). |
| Age verification | **PARTIAL (honest)** | Self-attestation gate + policy page; the app makes no claim of age proof (per §21 this must stay honest). |

## 4. Known defects / risks (open)

1. **Iwara/HMVmania/PMVHaven guest scope** — explicit-rated content requires platform accounts upstream; guest sees what sources serve anonymously (documented, honest).
2. **NSFW-API public instances dead** — provider stays installed but always errors until user configures own deployment.
3. **`bun run build` not part of CI** — master-ci node job runs lint+tsc; production build smoke test not yet a gate (add).
4. **Single-process cache** — TTL caches are in-memory; multi-instance deploys would each hold their own (irrelevant for personal use, documented).
5. **Egress IP rotation** — upstream signed tokens occasionally die mid-playback; auto-recovery exists but recovery latency is ~1–3s (measured informally).
6. **Reader page prefetch** — reader loads pages lazily but does not prefetch next page (bandwidth-optimal, UX tradeoff).
