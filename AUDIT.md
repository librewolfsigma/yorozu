# Yozora — Current-State Audit

**Date:** 2026-11-08 · **Commit:** `87bf4e9` (main) · **Method:** source inspection + live execution
(provider audit harness, browser E2E via agent-browser, direct upstream probes).
Every status below carries its evidence. Statuses: **REAL** (verified by execution) ·
**PARTIAL** (works but requirements missing) · **DEMO** (simulated) · **BROKEN** ·
**NOT IMPLEMENTED** · **BLOCKED** (reason stated).

Re-run the audit at any time: `bun scripts/audit-providers.ts "query"` and the browser
checks in `todo.md`.

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
