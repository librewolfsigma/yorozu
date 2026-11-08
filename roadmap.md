# Yozora — Roadmap

> Lightweight, universal, local-first personal media client.
> Mihon/Aniyomi-style source-driven browsing · Hikari-inspired content surfaces.
> **The application is the client, not a data center.**
>
> Companion documents: [`todo.md`](./todo.md) (operational checklist, continuously
> updated) · [`AUDIT.md`](./AUDIT.md) (evidence-based current state).
> This roadmap is reviewed at the end of every working session.

---

## 0. PIVOT (2026-11-08, user directive): product rebased onto seanime

**Decision.** The owner judged the in-house Next.js client "slop" compared to
[seanime](https://github.com/5rahim/seanime) (GPL-3.0, Go + React, ~13k★) and
directed: *fork seanime and implement our goals on it*. This supersedes the
in-house client track (Phases 1–10 below describe the legacy app — kept for
reference; the Next.js repo `yorozu` enters maintenance mode until retirement
is confirmed).

**New topology (verified):**

| Piece | Where | State |
|---|---|---|
| App base (fork) | [`librewolfsigma/yozora`](https://github.com/librewolfsigma/yozora) — fork of `5rahim/seanime`, full history, GPL-3.0 preserved | ✅ created 2026-11-08; pristine (no divergent commits — merges from upstream stay trivial) |
| Provider pack | [`librewolfsigma/yozora-extensions`](https://github.com/librewolfsigma/yozora-extensions) — seanime extension repository (`marketplace.json` + `repo.json` + 5 payloads) | ✅ published, install-sim all green |
| Legacy Next.js client | `librewolfsigma/yorozu` (this repo) + `yozora-legacy` (stale mirror, renamed) | maintenance mode |
| Verification harness | `~/work/ext-harness` (goja-faithful shim + live-upstream suites + install simulation) | to be moved into the extensions repo |

**Why this satisfies standing directives faster:**

- *Provider-based sources (Mihon-style)* → seanime's extension runtime **is**
  the Mihon-style provider architecture (sandboxed goja VMs, `class Provider`
  contract, extension repositories) — our goals become data+payloads, not app
  forks of logic.
- *Real integrations, never simulated* → the five extensions were verified
  end-to-end against live upstreams before publishing (40/40 checks incl.
  HTTP `206 video/mp4` Range probes on every stream and `image/webp` page
  loads; honest refusals where upstream lacks search — see todo Phase R).
- *SQLite, local-first, no login for the app, real download manager, desktop* →
  all inherited from seanime natively (SQLite library, local server, torrent +
  HTTP downloads, desktop builds).
- *Visual identity conflict (Hikari doc vs Aniyomi theme) — RESOLVED:* both are
  superseded by seanime's own UI; no further theming work on the legacy app.
- *Auth/testing directive changes* → seanime is single-user local (matches "no
  login"); Go-side tests + our extension harness cover the new track.

**Constraints / honest caveats:**

- Go is not installed in the sandbox — the fork cannot be built/run here yet.
  Extension payloads were verified with a goja-faithful harness instead;
  loading them inside a real seanime binary is the first pending Phase R task.
- Iwara/HMVmania have no keyless upstream search (re-verified 2026-11);
  their extensions refuse/return-empty honestly by design.

---

## 1. Product vision

Yozora lets one person discover, consume and organize adult media from many existing
upstream sources through a single fast client — instead of switching between a dozen
websites. It combines:

- **Mihon** — extension-based sources, browse/search/read, library management.
- **Aniyomi** — multi-media categories (anime + video), playback-oriented flows.
- **Hikari** — rich discovery surfaces, poster-first design, per-section identity.

Yozora owns **no catalog**: upstreams own content; Yozora presents it live with
bounded caches, and persists only user-owned data (preferences, library, progress,
history, collections, extension config).

## 2. Core principles (binding)

1. Functionality over appearance. 2. Reliability over feature quantity.
3. Lightweight architecture. 4. Real integrations, never simulations.
5. Local-first storage & privacy. 6. Provider independence.
7. Graceful degradation. 8. Extensibility without bloat.
9. Excellent navigation. 10. Evidence-based development — a feature is done when the
**user journey** is verified, not when the code exists.

## 3. Architecture today (verified)

- **Next.js 16 (App Router, Turbopack) + TypeScript** web client, bun runtime.
- **SQLite via Prisma** — user-owned rows only (see AUDIT §1); no content tables.
- **Live adapter layer** (`src/lib/providers/live/*`) behind a versioned `LiveAdapter`
  contract (search / popular / details / units / resolveChapter); declarative
  **extension-repo sync** interprets upstream manifests into data-only adapters.
- **Engine** (`src/lib/providers/engine.ts`): registry + overlay, search fan-out,
  paged category feeds (round-robin interleave), per-provider error isolation,
  honest capability derivation, UNCONFIGURED health state.
- **Media proxy** with strict allowlist + per-hop redirect validation (SSRF) +
  bounded responses + curl TLS fallback for challenged hosts.
- **Player** with automatic mid-stream recovery (stall/error → fresh resolve → remount).
- **CI**: master-ci (hygiene, gitleaks full-history, semgrep, node lint+tsc) + CodeQL.

## 4. Target architecture

Same as today, with these deltas (no rewrite justified — §28 "inspect, do not rewrite"):

- **Native desktop**: Tauri 2 + Rust shell reusing the Next.js frontend (Phase 8).
- **Download manager**: server-side queue (Node) streaming to disk, no full-file RAM
  buffering; UI queue/progress/pause/cancel (Phase 6).
- **Test pyramid**: bun unit tests for pure logic, route-level integration tests,
  agent-browser E2E scripts for golden journeys (Phase 0→9, ongoing).
- **Optional local password**: scrypt lib already exists; needs product decision
  (conflicts with the earlier "no login anywhere" directive — see todo `[?]`).

## 5. Product sections & scope

| Section | Scope | Current status (evidence in AUDIT.md) |
|---|---|---|
| **Anime** | HentaiOcean + NSFW-API streaming, AniList metadata, Sukebei torrents; watch progress | REAL core; schedules/seasonals missing |
| **Manga** | MangaDex, nhentai v2; in-app reading, progress | REAL |
| **Manhwa** | Manga18fx webtoon reader | REAL |
| **Doujin** | E-Hentai, WholesomeList, Sukebei, extension sources | REAL |
| **Video** | AV/JAV (JavDB, r18.dev, XVideos), PMV = PMVHaven, HMV = HMVmania + Iwara, Hentai (Rule34Video, Hanime) — never mixed with Anime | REAL, playback verified on all four slices |
| **Images** | Booru boards (single images, Danbooru-style UI) vs curated pools (collections UI) — distinct by design | REAL |
| **Games** | VNDB, DLsite metadata + official links (no piracy) | REAL (metadata-only by design) |
| **Databases/Scripts/Misc** | Wotaku directories | REAL |

## 6. Milestones & phases

Statuses: ✅ done · 🟡 in progress · ⬜ not started · 🔶 blocked/decision.

### Phase 0 — Audit & foundations ✅ (2026-11-08)
- Objectives: factual current state, CI gates, project docs.
- Deliverables: AUDIT.md, roadmap.md, todo.md, master-ci workflow (fixed trigger),
  typecheck gate green.
- Acceptance: audit entries carry execution evidence; CI green on push. **Met.**

### Phase 1 — Navigation & reliability foundation ✅ (done across sessions, verified)
- Client-not-database architecture; SSRF-hardened proxy; bounded caches; provider
  credential scrub; UNCONFIGURED health; mid-stream player recovery; metadata
  partial-failure fallback; Aniyomi chrome (sidebar/app bar/bottom nav/More screen).
- Acceptance: golden journeys browser-verified. **Met (AUDIT §3).**

### Phase 2 — Provider & extension infrastructure ✅ (core) / 🟡 polish
- ✅ 35 real providers; capability declarations; extension-repo sync; search fan-out
  with isolation; paged feeds everywhere (infinite scroll); audit harness.
- ⬜ Remaining: search source-selection UI + per-source timeout knobs; extension
  update-check flow + version-compat gate; per-provider capability matrix rendered in
  Extensions UI.
- Acceptance: one failing provider never suppresses others (verified for feed/search
  error strips); update check demonstrable end-to-end.

### Phase 3 — Anime client 🟡
- ✅ Streaming (HentaiOcean in-app, NSFW-API configurable), metadata, torrents,
  watch progress.
- ⬜ Seasonal/schedule discovery (AniList airing schedule), per-anime source choice
  when multiple providers serve the same title, trailer/episode-list parity.
- Acceptance: user can find a seasonal title and play it without leaving the app
  (when a source serves it).

### Phase 4 — Manga / Manhwa / Doujin clients ✅ (core) / 🟡 reader depth
- ✅ Three distinct categories; in-app reading with progress; nhentai/MangaDex/EH.
- ⬜ Reader layout modes (paged vs long-strip toggle), offline chapter downloads
  (depends on Phase 6 download manager), source-switching on zero results.
- Acceptance: read a chapter in both layouts; resume exactly where left off.

### Phase 5 — Video client ✅ (core) / 🟡
- ✅ Four distinct slices with exclusive per-directive sources; direct playback
  verified; watch progress.
- ⬜ Quality/multi-mirror selection UI where a source offers variants; external-player
  handoff (mpv) for desktop.

### Phase 6 — Library, tracking, offline 🟡
- ✅ Library (status chips), progress, history, collections, reviews.
- ⬜ **Download manager** (P1→P2): queue, progress, pause/resume/cancel, storage
  budget, offline reader/player; respect provider rules — stream-URL downloads only
  where the source serves plain files (no DRM circumvention, ever).
- ⬜ Optional local password (🔶 decision — see §8 Risks).

### Phase 7 — Hikari-inspired experiences ⬜ (deliberately deferred)
- Poster-fan hero polish, daily discovery, top rankings, collectible cards, reels.
- Rule: no P3 work while P0/P1 remain (§30).

### Phase 8 — Tauri/Rust Windows app ⬜
- Reuse the web frontend in Tauri 2; Rust side handles downloads/local storage.
- Acceptance: installer runs, journeys from AUDIT §3 pass against the desktop shell.

### Phase 9 — Performance, security & regression hardening 🟡 (ongoing)
- ✅ CI gates (lint, tsc, gitleaks, semgrep, CodeQL); bounded-resource discipline.
- 🟡 Unit tests for pure logic (being added); route integration tests; E2E scripts.
- ⬜ Production-build smoke gate (`next build` in CI); RAM/CPU measurement harness.

### Phase 10 — Stable personal-use release ⬜
- Criteria in §10 below.

## 7. Performance goals (measured, not claimed)

| Metric | Target | Current |
|---|---|---|
| Cold start (dev server first paint) | < 2.5s | ~1.5–2s observed |
| Category feed first page | < 1.5s | 0.3–1.2s (provider-dependent) |
| Search fan-out | < 3s with slow-provider isolation | ~2–4s (slowest provider bounds it) |
| Idle CPU (no playback) | ~0% | polling only notifications (60s interval) |
| Memory | bounded caches ≤ 600 entries + 8MB/response cap | by construction |
| Downloads | streamed, never full-file in RAM | N/A yet (Phase 6) |

## 8. Reliability goals

- One failing provider NEVER breaks a feed/search/detail flow (verified: error
  strips + per-provider isolation + metadata fallback).
- Every cache: bounded size, TTL, stale-recovery (re-fetch on expiry; extension
  sync keeps last-good manifest).
- Upstream contract changes fail loudly in audit runs, not silently in the UI.
- Signed stream URLs re-resolved on death (fresh=1 path).

## 9. Testing strategy

Layers (per master directive §23 — supersedes the earlier "no test code" rule):

1. **Unit (bun test)** — pure logic: serialization/dedupe, cache TTL, feed
   interleave, proxy allowlist, auth hashing, tag filtering. *Being added.*
2. **Integration** — API routes against a test DB (bun test + prisma test db).
3. **E2E (agent-browser scripts)** — golden journeys listed in AUDIT §3.
4. **Live provider audit** — `scripts/audit-providers.ts` (29/5/1 of 35 at last run).
5. **CI gates** — master-ci + CodeQL + unit job.

A bug fix without a regression test requires a written justification in todo.md.

## 10. Release criteria (Phase 10)

All P0/P1 todo items `[x]` with evidence; zero known crashes in golden journeys;
downloads functional for at least manga chapters; CI fully green including build
smoke; docs match implementation; the owner completes a full session (discover →
read/watch → track → resume) without touching another app.

## 11. Known architectural limitations (accepted, documented)

1. In-memory caches are per-process (fine for single-user personal deployment).
2. Guest-only upstream APIs (Iwara search, PMVHaven text search, r18.dev search)
   cap capability — declared honestly per provider.
3. Stream URLs are ephemeral by upstream design; recovery flow compensates.
4. Self-hosted NSFW-API needed for that aggregator until upstream instances recover.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Upstream API/site changes break adapters | audit harness catches; adapters fail loudly; extension recipes are data (no app update needed for recipe-only fixes) |
| Scope creep toward a social network / marketplace | Phase 7 explicitly deferred; §30 priority rule enforced in todo review |
| Theme direction tension (Hikari palette §14 vs Aniyomi retheme directive) | Current: Aniyomi chrome + Hikari-inspired content surfaces; palette change recorded as `[?]` decision for the owner — no more flip-flops without explicit instruction |
| "No login" vs master §18 local password | scrypt+session infra exists; implementation gated on owner decision (todo `[?]`) |
| Legal/content safety | 18+ gate, content policy page, honest provenance, no DRM/paywall circumvention, no CSAM/ambiguous-age tolerance — fail closed |

## 13. Explicitly deferred

Collectible card games · social/community · reels/short-form · shop experiences ·
multi-user infrastructure · cloud sync · Linux/macOS packaging (post-Windows) ·
paid-API-backed recommendations.
