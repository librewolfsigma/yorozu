# Yozora — todo.md

> Operational source of truth. Updated at the start and end of every working session.
> Statuses: `[ ]` not started · `[x]` done + **verified (evidence recorded)** ·
> `[/]` in progress · `[!]` blocked (reason stated) · `[?]` needs owner decision/investigation.
> Completion requires journey-level verification — code existing is not completion.
> Strategic context: [`roadmap.md`](./roadmap.md) · evidence baseline: [`AUDIT.md`](./AUDIT.md).

Legend for evidence tags: `audit:` provider-audit run · `e2e:` agent-browser session ·
`tsc:`/`lint:` gate run · `probe:` direct upstream probe.

---

## Phase R — Rebase onto seanime (ACTIVE TRACK, supersedes Phases 1–10)

Owner directive 2026-11-08: fork [seanime](https://github.com/5rahim/seanime)
and implement Yozora's goals on it. See roadmap §0.

- [x] Attempt GitHub fork; stale `yozora` Next.js mirror renamed to `yozora-legacy`
  (mirror backup kept at `~/work/yozora-legacy-backup.git`) — `probe:` API 200
- [x] Fork created: [librewolfsigma/yozora](https://github.com/librewolfsigma/yozora),
  full history, GPL-3.0, description set — `probe:` API shows fork:true, size 579570
- [x] Extension system studied from source (evidence: `internal/extension_repo/`):
  global `class Provider` contract for manga-provider (search/findChapters/
  findChapterPages/getSettings) and onlinestream-provider (search/findEpisodes/
  findEpisodeServer/getSettings); payload TS→JS via esbuild (ES2018); goja fetch
  binds a Chrome UA by default; `res.text()/json()` are sync; marketplace is an
  array of manifest summaries; install-repository takes `{urls:[...]}`
- [x] 5 extensions implemented + ported from verified live adapters:
  yozora-nhentai (manga), yozora-hentaiocean, yozora-iwara, yozora-pmvhaven,
  yozora-hmvmania (onlinestream) — evidence: harness 40/40 (live upstreams;
  HTTP 206 video/mp4 on every stream; image/webp pages; honest-refusal checks)
- [x] Published to `yozora-extensions` (commit `4a8bc69`): manifests w/ payloadURI,
  icons, READMEs, `marketplace.json`, `repo.json`; all 10 runtime raw URLs → 200
- [x] Install simulation green (repo.json → manifests → payloads → transpile →
  `new Provider()` → getSettings → marketplace consistency)
- [x] **Go toolchain installed (tarball → ~/go), fork server BUILT and RUN headless**
  (`go build -o /tmp/seanime-test -trimpath -ldflags="-s -w"`; placeholder
  `web/index.html` satisfies `//go:embed all:web`; server up on 127.0.0.1:43211)
- [x] **Real-runtime verification of the extension pack** (built binary + live API):
  install-repository API consumed `repo.json` → all 5 extensions loaded, zero
  invalid (`POST /api/v1/extensions/all`); real searches through the server:
  hentaiocean 20 results · pmvhaven results · hmvmania `[]` honest · iwara
  refusal with full message · nhentai 24 results with covers
  (`/api/v1/onlinestream/search`, `/api/v1/manga/search`); manual-mapping accepted
- [x] UX fix from real-runtime finding: goja promise rejections export Error
  objects as empty maps (message lost) → payloads now throw plain strings;
  re-verified in real runtime (`promise rejected: iwara: text search needs an
  Iwara account upstream …`)
- [x] Install-simulation + 40/40 harness green after the string-throw change;
  note: raw.githubusercontent CDN served stale payloads for ~4 min after push
  (reinstall must wait for CDN freshness — documented pitfall)
- [x] **Website directive fulfilled (session D, 2026-11-08):** product serves at
  the preview URL — `proxy.ts` rewrites all product routes to the Go server
  (`127.0.0.1:43211`), binary spawned as detached child of the dev server by
  `instrumentation.ts` keepalive, `bridge-boot` API available for on-demand boot;
  WS `/events` rides the Caddy gateway (`XTransformPort=43211`, fork commit
  `33beaaf9`) — `e2e:` agent-browser on the preview origin: UI rendered (title
  "Seanime"), WS opened, server status received (correct dataDir), wizard steps
  on click, zero page errors
- [x] **Sandbox-recycle recovery (session D):** recycle wiped everything outside
  `my-project` (binary, Go, data dir) → rebuilt end-to-end with all artifacts
  persisted INSIDE the project (`.toolchain/go` 1.27.3 + caches,
  `vendor/yozora` clone, `.yozora/runtime` binary 79.9 MB, `.yozora/data`);
  fixed stale-keepalive boot race by versioning the boot globals (V2) —
  `probe:` bridge-boot `{up:true,binExists:true}`; go-root 200; via-proxy 200
- [x] Extension pack reinstalled through the LIVE server API
  (`POST /api/v1/extensions/external/install-repository` with raw
  `repo.json` URL — API takes the direct manifest URL, not the repo slug):
  **9 extensions loaded** (5 providers + 3 custom-source browse variants +
  local-manga) — `probe:` extensions/list
- [x] CustomSource evaluation done in session C: `yozora-{nhentai,hmvmania,
  pmvhaven}-cs` custom-source extensions exist in the pack and load in the
  real runtime — `probe:` extensions/list shows all three `custom-source` ids
- [x] Real searches re-verified against the rebuilt binary: hentaiocean 20
  results · nhentai 24 results · iwara honest refusal (full ported message) —
  `probe:` `/api/v1/onlinestream/search`, `/api/v1/manga/search`; note:
  search bodies use `provider` key; passwordless privileged endpoints require
  a parseable trusted Origin header (localhost Origin accepted)
- [x] Recycle-proof provisioning committed: `scripts/provision-yozora-runtime.sh`
  (fast path = ensure binary; `--force` = rebuild web + Go) + `.gitignore`
  entries for `.yozora/ .toolchain/ vendor/`
- [x] **Custom-source metadata + streaming FIXED end-to-end and verified on the
  live preview (session F, 2026-11-09)** — user-reported bug "custom source
  metadata and streaming doesn't work". Three stacked root causes, all fixed:
  (1) fork code fixes existed but were never deployed — the sandbox recycle
  wiped `.yozora/runtime`; full provision → rebuild → reinstall → verify cycle
  run (`probe:` browse 40 entries · episode-list 1 ep · episode-source MP4 ·
  range probe **206 video/mp4**); (2) **MediaFormat enum violation** — nhentai-cs
  payload piped the lowercase category tag ("manga") into the AniList format
  field; Go `BaseManga` unmarshal rejected it (`manga is not a valid MediaFormat`)
  so getManga ALWAYS failed — listing worked because list results omit the
  category tag. Fixed payload-side (yozora-extensions `7ae1e22`, format pinned
  to `MANGA`, category surfaced as first genre) — `probe:` entry API now returns
  real title/description/cover; (3) **recovery-placeholder cache poisoning** —
  one failed provider fetch cached the slug-derived placeholder permanently.
  Fixed fork-side: provider retry-once + real error logged + provisional flag;
  simulated/anilist platforms never cache provisional media (fork `cdf5509c`).
  `e2e:` browser on preview origin — manga entry shows real title/tags/273
  pages; anime entry player **t=4.0s readyState=4** (stream riding the preview
  proxy). Screenshots: `upload/e2e-custom-source-playing.png`,
  `upload/e2e-custom-source-manga-metadata.png`
- [x] Fork hardening shipped with the fix (fork `cdf5509c`): collection
  metadata refresh now covers paused/planning entries (test spec was red on
  main — verified pre-existing via stash-diff); `go vet ./...` fully clean
  (6 deferred time.Since, 2 format strings, ScanLogger mutex copy — TestScanLogger
  now green, dummy-debrid chunk-size fallback to the 64KiB default);
  fixture-gated scanner tests skip honestly instead of failing CI
  (`anilist.IsMissingFixtureError`)
- [x] Payload hardening (yozora-extensions `dc10d4b`): nhentai-cs getJson
  bounded to 8s + retry once — matched the onlinestream providers;
  installed into the live server via the real edit-payload API when the
  raw CDN lagged the push
- [!] Real playback chain (episode-list → episode-source → player; manga
  chapters → pages) — **custom-source entries: VERIFIED WORKING (above).
  Still blocked for AniList-collection media: server runs with SIMULATED
  AniList token (no account) and empty collection, and episode endpoints
  require a media in the AniList collection.** Needs owner run with a real
  AniList login.
- [!] **NEW platform pitfall (session F): disk-pressure reaper.** When rootfs
  usage crosses ~90%, the platform silently deletes `node_modules` (and other
  large fresh dirs) within seconds — twice mid-session. Recovery that held:
  free disk first (removed seanime-web node_modules 684M + Go tarball +
  `go clean -cache` on the 4.6G build cache → 28% usage), THEN bun install —
  node_modules survived at 41%. Watchdog should re-order: check disk usage
  before bun install, and never rebuild Go while the reaper is active.
- [ ] **NEXT CYCLE (top pick): make the FULL `go test ./...` green** — full-repo
  sweep (session F, `/tmp/gotest_full2.log`): 65 packages ok, 7 fail with 33
  tests. Diagnosed: ~31 are the SAME fixture-gated class already fixed in
  scanner (missing AniList fixtures → `t.Fatal` instead of skip) in
  `internal/local`, `internal/library/anime`, `internal/library/autodownloader`,
  `internal/api/anilist`, partially `internal/notifier` — fix centrally via
  per-package `TestMain` that skips when `AnimeCollection` fixtures are absent.
  NOT fixture-related: `goja_bindings TestFetchRedirectOptions/follow`
  (UPSTREAM-inherited, fails on pristine tree: CF-bypass client retries the
  302 so `url`/`redirected` report the pre-redirect URL; body/status correct —
  minor reporting bug, fix in fetch.go response URL derivation) and
  `db TestDatabaseCleanupManager` (47s, creates ~450MB tempdata — verify on
  a roomier runner or make the budget configurable). CI currently red on
  these — the scanner/`vet` fixes in `cdf5509c` were step one.
- [ ] Move verification harness (`~/work/ext-harness`: harness.ts, install-sim.ts,
  icons.ts) into `yozora-extensions` repo + CI workflow to run it on every push
- [ ] NSFW-API self-host as a user-config extension (manifest `userConfig`
  baseUrl field) — needs a reachable self-hosted instance to verify against
- [ ] Fork sync policy: periodic `gh repo sync librewolfsigma/yozora` (or API
  merge-upstream); fork now carries **one** infra commit (`33beaaf9`, gateway
  WS — hosting requirement) until custom branding is actually needed
- [?] Owner decision: retire the legacy Next.js app (`yorozu`) once seanime
  track is confirmed working end-to-end on the owner's machine (note: `yorozu`
  is now the HOSTING SHELL for the preview site — retirement needs a new plan
  for that role)

### Session D leftovers (next session, in order)

- [x] CI gates for the fork (adapt WasewaseX/master-ci to Go): go vet + go
  build + go test (+ web build job); wire into GitHub Actions — commit
  `17d0f8c1` pushed, `.github/workflows/ci.yml` present in fork
- [x] Re-verify the wizard→library flow in a fresh browser profile after
  config change — done in session E, see below

### Session E (2026-11-08): the 403 "requires server password or trusted local origin" — ROOT-CAUSED AND FIXED IN THE FORK

User hit the wizard's Launch Seanime → `403 this action requires either a
server password or a trusted local origin`. Two upstream incoherencies, both
now owned as fork commits (pushed):

- [x] **Root cause 1 — allowlist incoherence** (`43f8ca1d`): upstream's
  `server.accessAllowlist` is documented as "additional remote hosts/origins
  allowed through the passwordless API/events boundary" but the PRIVILEGED
  guards (settings mutations, extension management, local execution, media
  player/torrent/mediastream) never consulted it — an explicitly allowlisted
  deployment origin could read the API yet fail every privileged write.
  Fix: `isTrustedRequestWithAllowlist` + `isStrictLocalBoundarySatisfied`
  threaded through all eight privileged guards and the strict_* guards.
  `test:` full handlers suite green; 7 new regression subtests
- [x] **Root cause 2 — origin-less proxy-hop denial** (`cc774bb1`): the site
  proxy terminates the browser boundary locally and strips Origin/Referer
  (by design), but upstream privileged guards denied origin-less requests in
  passwordless mode even when the TCP client is the loopback proxy itself —
  while the passive boundary already allowed such requests for reads.
  Fix: `isTrustedRequest` (default mode) grants trust to origin-less requests
  from the local machine itself (loopback, no untrusted forwarded hop);
  LAN-private clients KEEP the upstream require-origin behavior (upstream
  tests `rejects missing origin` still green); hardened/strict unaffected;
  requests carrying Origin metadata unaffected.
  `test:` full handlers suite green; 6 new regression subtests; pre-existing
  platform bug fixed (`TestUsesPrivilegedCommandSettings` hardcoded macOS
  paths, failed on Linux)
- [x] **Differential proof (live server, real HTTP)**: direct-to-Go
  `POST /api/v1/extensions/external/install-repository` (invalid URI, no
  install) — preview origin → guard passes → 500 manifest-validation error;
  evil origin → 403 guard error; origin-less loopback → guard passes → 500.
  CSRF boundary intact.
- [x] **Browser E2E, full journey** (`e2e:` agent-browser via Caddy gateway —
  same chain as the preview URL): fresh wizard → library path filled →
  player/torrent/debrid steps → features step (exact screenshot state) →
  **Launch Seanime → server log `POST /api/v1/start status=200`** (was 403
  at 18:53, 200 at 19:37) → AniList login gate (honest: needs a real token)
  → skip → **main app UI**: Home/Schedule/Manga/My lists/Discover nav,
  trending carousels render. Screenshots: `upload/e2e-anilist-gate.png`,
  `upload/e2e-main-ui.png`
- [x] **Content flow through the full preview chain**: nhentai search via
  `POST /api/v1/manga/search` (Caddy → Next proxy → Go) returns live results
- [x] **Sandbox volatility characterized + mitigated**: between tool sessions
  the platform wipes `node_modules` and kills processes (project files
  persist — fork commits/binary/data survive). Platform-level watchdog cron
  (job `515740`, every 5 min) re-installs deps and respawns Go + Next as
  needed — self-healing deployment
- [!] Real playback chain (episode-list → episode-source → player; manga
  chapters → pages) — still blocked on a real AniList login (owner action);
  unchanged from session D
- [ ] Owner decision: retire the legacy Next.js app (`yorozu`) once seanime
  track is confirmed working end-to-end on the owner's machine (note: `yorozu`
  is now the HOSTING SHELL for the preview site — retirement needs a new plan
  for that role)

---

## Phase 0 — Foundations (LEGACY Next.js track)

- [x] CI gates installed from WasewaseX/master-ci (master quick profile + CodeQL); trigger fixed `branches: [main]` — evidence: `.github/workflows/ci.yml`, tsc+lint green 2026-11-08
- [x] Fix all reported lint findings (chart innerHTML → textContent ref; unused imports/params; a11y already hardened) — evidence: `lint:` clean
- [x] `tsc --noEmit` green (fixed booru thumbUrl null/undefined, nsfwapi popular config contract, embedded prop types, engine dto ref) — evidence: `tsc:` clean 2026-11-08
- [x] AUDIT.md with execution evidence — 2026-11-08
- [x] roadmap.md phases with acceptance criteria — 2026-11-08
- [ ] Add production-build smoke gate to CI (`next build` job; currently only lint+tsc run) — **blocks Phase 10**

## Phase 1 — Navigation & reliability (verified)

- [x] Client-not-database core (no content tables; live fetch + TTL only) — evidence: schema + route greps
- [x] SSRF guard: per-hop redirect validation + curl final-destination check — evidence: probe 403
- [x] Provider credentials never in public API responses (`toPublicProvider`) — evidence: secret-set probe, zero leakage
- [x] UNCONFIGURED health state for key-gated providers (never ERROR) — evidence: stashdb health API
- [x] Aniyomi chrome: desktop drawer, mobile app bar + 5-tab nav, /more screen — evidence: `e2e:` screenshots 2026-11-08
- [x] Mid-stream recovery (stall/error → fresh=1 resolve → remount) — evidence: `e2e:` observed live recovery
- [x] Metadata partial-failure fallback (no 502 detail pages) — evidence: code + probe
- [x] Reader keyed chapter remount (page index resets) — evidence: code review
- [x] Browser back/forward + scroll restoration: push navs scroll to top; back/forward restore each hash's saved position (lazy-feed retry loop until content is tall enough) — evidence: `e2e:` back detail→feed restored scrollY=800, forward restored 600 (2026-11-08)
- [ ] Keyboard navigation audit (focus traps in dialogs, arrow-key grids) — P2

## Phase 2 — Provider & extension infrastructure

- [x] 35 real providers; kind scoping per directive (PMV=PMVHaven, HMV=HMVmania+Iwara, AniDB removed) — evidence: `audit:` 29 ok/5 gated/1 honest-fail of 35
- [x] Streams verified end-to-end: HentaiOcean, Iwara, HMVmania, PMVHaven (206 mp4, playing) — evidence: `probe:` + `e2e:`
- [x] nhentai v2 in-app reading (63-page gallery, 200 image/webp) — evidence: `probe:` + `e2e:`
- [x] Extension-repo sync (yozora-extensions manifest → recipe adapters, HentaiFox live) — evidence: `e2e:` sync panel
- [x] Paged feeds everywhere (category feeds + source pages, real upstream page N) — evidence: `e2e:` sentinel auto-page 1→2
- [x] Honest search-less declarations (Iwara guest, HMVmania WP search) — evidence: `probe:` (search param ignored / zero video cards)
- [ ] Search source-selection UI: per-source checkboxes + "search only this source" entry point (search.tsx groups exist; add filter row) — **P1**
- [ ] Per-provider search timeout knob (engine: wrap searchOneProvider with configurable race) — **P1**
- [ ] Extension update-check UI ("N updates available" from repo manifests; version-compat gate `minAppVersion`) — **P1**
- [ ] Capability matrix rendered per provider in Extensions (capability icons exist in Sources; add full matrix to detail panel) — P2
- [ ] Probe replacement public NSFW-API instances or publish our own Workers deployment (owner has account) — `[!]` needs owner's Cloudflare account

## Phase 3 — Anime client

- [x] HentaiOcean streaming (in-app player, verified) — evidence: `e2e:` readyState 4, t advancing
- [x] AniList metadata + Sukebei torrents — evidence: `audit:`
- [ ] AniList airing-schedule discovery (seasonal + "simulcast this week" feed on the Anime section) — P2
- [ ] Multi-source episode aggregation when 2+ providers serve the same title (start: title-normalized matching between HentaiOcean and AniList search) — P2
- [ ] Resume banner on detail page ("Continue S1E4 · 12:30") — P2

## Phase 4 — Manga / Manhwa / Doujin

- [x] Distinct MANGA / DOUJIN / MANHWA categories + readers — evidence: `e2e:`
- [x] Reading progress persistence + resume deep links — evidence: continue-watching strip + progress API 200s
- [ ] Reader layout modes: paged ⇄ long-strip toggle with per-title memory — **P1**
- [ ] Next-chapter prefetch boundary (prefetch page 1 of next chapter only) — P2
- [ ] Offline chapters (depends on download manager below) — P2

## Phase 5 — Video client

- [x] AV/JAV/PMV/HMV/HENTAI slices with exclusive sources + playback verified — evidence: `e2e:` all four
- [ ] Stream-variant picker (Iwara returns multiple qualities — surface 360/720/1080) — P2
- [ ] External-player handoff (copy direct URL / open in mpv via protocol on desktop) — P3

## Phase 6 — Library, tracking, offline

- [x] Library status chips, favorites, collections, reviews, history — evidence: routes + `e2e:`
- [ ] **Download manager** (P1): queue table (Download rows), stream-to-disk (Node streams, byte budget), progress events (SSE or polling), pause/cancel/retry, storage settings, offline reader flag
  - [ ] Design pass: Prisma Download model + /api/downloads routes + queue worker
  - [ ] Manga chapter downloads first (plain image URLs — safe, in-policy)
  - [ ] Offline reader mode (serve from disk via /api/pages/local)
  - [ ] Video downloads ONLY where upstream serves plain MP4 (PMVHaven/HMVmania/Iwara/HentaiOcean) — never DRM
- [ ] Storage budget UI (max GB + auto-evict oldest watched) — P2
- [ ] Optional local password login — `[?]` **owner decision**: master vision §18 requests one local user w/ password; earlier directive said "no login anywhere". scrypt+session infra already exists (`src/lib/auth.ts`). Implement as opt-in lock screen if approved.

## Phase 7 — Hikari-inspired experiences (deferred — do not start while P1 open)

- [ ] Daily discovery feed (deterministic per-date rotation across providers)
- [ ] Top-ranking surfaces per section (provider-native ranking params where available)
- [ ] Collectible cards / reels — P3, explicitly deferred

## Phase 8 — Tauri/Rust Windows app

- [ ] Feasibility spike: Tauri 2 + Next.js static export vs sidecar server — `[?]` reader needs offline support decision first (Phase 6)
- [ ] Packaging + auto-update channel — P3

## Phase 9 — Performance, security & regression hardening

- [x] CI: lint + tsc + gitleaks + semgrep + CodeQL — evidence: workflow + green gates
- [x] Bounded caches + bounded responses + request dedupe — evidence: http.ts/cache.ts
- [x] Unit tests: core pure logic — evidence: `bun test` suite below, CI job added
- [ ] Unit tests: metadata merge/normalize, tag filter, recommendation helpers (as they land)
- [ ] Integration tests: /api/feed + /api/work + /api/search against test DB
- [ ] E2E scripts: codify AUDIT §3 journeys into runnable agent-browser script
- [ ] RAM/CPU measurement note (server + browser) in docs/perf.md — P2

## Phase 10 — Stable personal release

- [ ] All P1 items above `[x]` with evidence
- [ ] Full owner session without leaving the app (acceptance run, recorded)

---

## Unit test suite (Phase 9.3)

Files live in `tests/unit/*.test.ts` (bun test). Run: `bun test`.

- [x] `serialize.test.ts` — dedupeByRef, toWorkDTO field mapping, ref stability
- [x] `cache.test.ts` — TTL expiry, bounded size eviction
- [x] `feed-interleave.test.ts` — round-robin fairness, dedup across providers
- [x] `imgproxy-allowlist.test.ts` — allowlist accept/deny, suffix matching, SSRF strings rejected
- [x] `auth.test.ts` — scrypt hash/verify roundtrip, wrong-password rejection
- [x] `category-meta.test.ts` — taxonomy invariants (manga≠doujin≠manhwa; PMV/HMV exclusivity maps)

---

## Session log

- **2026-11-08 (session A)** — Phase 0 delivered: CI trigger fix, tsc green (4 real
  type errors fixed), AUDIT/roadmap/todo created, unit suite (30 tests/6 files) +
  CI unit job added. Next: search source-selection UI (Phase 2), reader layouts (P4).
- **2026-11-08 (session B)** — Navigation reliability: back/forward scroll restoration
  implemented in the hash router (push vs pop distinction, per-hash scroll journal in
  sessionStorage, lazy-feed retry restore). Verified via agent-browser both directions.
  Next recommended task: search source-selection UI + per-source timeout (Phase 2).
- **2026-11-08 (session C)** — **PIVOT**: seanime fork created (`librewolfsigma/yozora`),
  5-extension provider pack published to `yozora-extensions` (40/40 live harness,
  install-sim all green), Phase R opened in this file, roadmap §0 records the
  decision + honest caveats (Go missing in sandbox → real-binary load test pending).
  Legacy Next.js track moved to maintenance. Next: install Go or verify on owner
  machine; move harness into extensions repo; CustomSource browse evaluation.
- **2026-11-08 (session C cont.)** — Go installed from tarball; **Yozora fork built
  and run headless**; extension pack installed through the real runtime API
  (5/5 loaded, 0 invalid) and real searches verified for all five providers;
  string-throw UX fix shipped after finding Error-object messages get mangled
  by goja rejection export; playback chain deferred to owner's AniList account
  (simulated token in sandbox — see Phase R).
- **2026-11-09 (session F)** — Recycle recovery + the custom-source bug hunt:
  provision script rebuilt everything (binary 77M with the previously-shipped
  custom-source fixes), 9 extensions reinstalled, wizard re-completed via
  `/api/v1/start`. Deployed fixes verified E2E (browse → metadata → episodes →
  206 mp4 → player t=4s; manga real metadata + 273 pages). Found + fixed the
  REAL metadata root cause (MediaFormat enum violation in nhentai-cs payload)
  and the placeholder-cache poisoning (fork cdf5509c). eslint ignores scoped to
  the fork era (vendor/.toolchain were being linted); lint clean. NEW pitfall:
  platform disk-pressure reaper deletes node_modules mid-session — documented
  recovery order. Next: continue roadmap P1s (search source-selection UI,
  reader layouts, download manager design).
