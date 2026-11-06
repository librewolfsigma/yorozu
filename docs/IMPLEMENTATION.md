# Yozora — NSFW Universal Media Platform: Implementation Report

**Delivered:** 2026-11-06 · **Stack:** Next.js 16 (App Router) · TypeScript · Prisma/SQLite · Tailwind CSS 4 · shadcn/ui (New York) · TanStack Query · Zustand-free (React Query + contexts) · Framer Motion · ffmpeg-generated sample media · AI-generated hero art

---

## 1. What was built

A complete, working, independent adult-only (18+) universal media platform in the spirit of
Mihon (provider extensions) + AniList (tracking/database) + Hikari (design/UX), realized as
**one unified app** (not several disconnected pieces).

Preview: the sandbox exposes a single route — the whole app runs at `/` with hash-based
routing (`#/browse/ANIME`, `#/media/slug`, `#/read/slug/chapterId`, …). All "pages" are
client views; all data flows through `/api/*` route handlers (no server actions).

## 2. Reconnaissance (Phase 1 — completed by subagents)

| Task | Output |
|---|---|
| **1-a Hikari design study** (myhikari.in) | `docs/recon/hikari-design.md` — OBSERVED palette (`#0B1622` bg, `#151F2E` surface, `#23324A` line, `#9FADBD/#E4EDF6/#6C8299` text ramp, accent `#3DB4F2`, per-section "hub" accents, `#3DB4F2→#8B5CF6` CTA gradient), typography, 1140px container, 6-col poster grid, hover motion budget, mobile tabbar + 7 annotated screenshots. Note: the live site is a Persian RTL anime portal; the *design language* was recreated, not the content. |
| **1-b Wotaku NSFW inventory** (wotaku.wiki/nsfw) | `docs/recon/wotaku-sources.md` — 145 sources / 157 URLs across 13 tabs (anime 17, manga/doujinshi 14, pornhwa 24, illustrations 16, AV 15, games 17, databases 6, scripts 14, apps 23, misc 5) with purpose/integration/auth per source. **Key OBSERVED fact: the wiki advertises 0 official APIs**; integration signals are indirect (open-source front-ends like PixivFE/Booruview, Mihon/Aniyomi extensions, RSS on AniSchedule, direct downloads, auth walls on F95Zone/E-Hentai). This directly shaped the honest provider architecture below. |

## 3. Architecture (Phase 2)

### Unified database (Prisma/SQLite — `prisma/schema.prisma`)
- **Provider system:** `Provider` (installed adapter instances w/ capabilities, config schema, health status) + `CatalogItem` (raw provider-side entries, `titleKey` normalized) + `ProviderLink` (many-providers → one `Media`).
- **Unified media:** `Media` with titles/alt-titles, covers/banners, genres/tags, studios/creators, ratings, popularity, content flags, external links, per-title accent colors.
- **Content units:** `Episode` (streams nullable — honest availability), `Chapter`+`ChapterPage` (3,947 seeded pages), `GalleryImage` (per-image tags/favorites).
- **Tracking:** `LibraryEntry` (5 statuses, scores, favorites), `Progress` (per chapter/episode/page/second), `HistoryEntry`, `Collection`/`CollectionItem`, `Review` (aggregate recompute), `GalleryFavorite`.
- **Metadata DB:** `Character`/`MediaCharacter`, `Person`/`MediaPerson` (studios/authors/artists/directors/developers), `TagDef` (68 tags with live counts).
- **Platform:** `Notification`, `Report` (moderation), `Download` (queue/progress), `ScriptInstall` (permission grants), `User`/`Session` (scrypt-hashed passwords, HttpOnly cookie sessions).

### Provider engine (Mihon-inspired — `src/lib/providers/`)
- Static `PROVIDER_REGISTRY` = extension repository; installed adapters are DB rows.
- Install / uninstall (non-destructive — catalog preserved in repository) / enable / disable / configure (typed config schema, required fields enforced) / health-check (per-provider simulation incl. config-required failures and documented network jitter on SakuraScan to exercise retry paths).
- **Duplicate detection & merge:** import normalizes titles (`titleKey`); same title from a second provider links into the existing unified `Media` instead of duplicating (demo: *Fox Spirit Fever*, *Midnight Library of Desires*).
- Import materializes episodes/chapters/pages/gallery deterministically (`src/lib/content-factory.ts` shared with the seeder).
- One broken provider never breaks the platform: all catalog/provider calls are isolated and report per-provider status.

## 4. Content categories (all 9)

| Category | UX | Data |
|---|---|---|
| Anime | Watch view w/ real HTML5 player, scene/episode sidebar, progress sync every 10 s | 8 titles, 98 episodes |
| Manga | Full reader: **paged** (tap zones, slider, fit-width/height, keyboard) + **webtoon long-strip** (IntersectionObserver progress) | 8 titles, ~180 chapters, 3,947 pages |
| Manhwa | Same reader (webtoon default), full-color branding | 7 titles |
| Illustrations | Masonry gallery + zoomable lightbox (favorites, per-image tags, download) | 8 packs, 154 images |
| AV | Player + scene list; one scene streams a real local MP4 (ffmpeg gradient render) proving the pipeline; others show an honest "no authorized stream" state | 7 features, 20 scenes |
| Games | Database cards with engine/requirements/official links; simulated install downloads | 6 titles |
| Scripts | Catalog with per-domain permission manifests, sandboxed installs (enable/disable, never executed) | 5 scripts |
| Databases | Browsers for characters (24), creators/studios (18), tags (68) + platform statistics | full |
| Miscellaneous | Curated guides/software/reference (privacy, safety, Wotaku directory) linking to official pages | 5 resources |

## 5. Universal features

Global search (unified DB + provider results with import action) · advanced filters (genres, year, status, sort, facets) · personal library w/ 5 statuses · favorites · collections · history timeline · progress sync (reader + player) · content-based recommendations ("Because you enjoyed X") · reviews w/ aggregate ratings · download manager (queue/pause/resume/cancel/retry, time-based simulated transfers, completion notifications) · provider manager · notifications (event-driven: imports, health failures, download completions, new-chapter seeds) · profiles w/ statistics · settings · responsive mobile layout w/ bottom tabbar · sticky footer (verified: gap=0 on short pages, natural push on long pages) · Ctrl+K search palette · 18+ age gate (cookie + localStorage) · content warnings on every title · reporting/moderation.

## 6. Design (Hikari-inspired, original code)

Recreated from the OBSERVED design tokens: navy `#0B1622` base, one surface step, hairline borders, 3-step text ramp, electric-blue default accent + **per-section hub colors** (anime blue, manga teal, manhwa amber, illustrations purple, AV pink, games orange, scripts green), blue→violet gradient CTA with violet glow, glass header on scroll, 2/3 poster cards with inset ring + 1.05 image zoom (0.7 s ease-out), lift −2px hover, 1140px container, 6→3 col responsive grid, mobile bottom tabbar, `prefers-reduced-motion` support. Typography: Lalezar display + Inter body (Google Fonts `<link>`, graceful fallback). Detail pages derive a **per-title themed hero** from the item's accent. All artwork is generated locally (deterministic SVG covers/pages/galleries) or AI-generated scenery — **zero explicit media ships with the platform**.

## 7. Verification (Phase 6 — browser-verified, not assumed)

Executed with a real headless browser (agent-browser); screenshots in `docs/recon/yz-*.png`:

- ✅ Age gate blocks, then persists; home renders hero/rails/grids/stats
- ✅ Demo login (one-click) → notifications badge, avatar menu
- ✅ Browse w/ filters + category accents; detail page w/ dedup provider chips + content notice
- ✅ Reader: webtoon + paged modes, chapter select, 13 progress syncs recorded server-side; library auto-advance wired
- ✅ Gallery masonry + lightbox (favorite/zoom/download); duplicate-key React error found & fixed
- ✅ Player: demo MP4 actually plays; custom controls; scene sidebar; honest no-stream state elsewhere
- ✅ Extensions: health checks all run; InkVault ERROR→Configure dialog→mirror set→health ACTIVE; repository install/uninstall (12↔13) preserves data
- ✅ Search grouped results; library statuses/counts/favorites; downloads reach 100% Completed; event notifications delivered
- ✅ Sticky footer verified both cases; mobile 390px layout + bottom tabbar verified
- ✅ `bun run lint` clean; dev.log free of runtime errors after fixes (2 lint errors, 1 parse error, 1 wrong-module import, duplicate React keys — all fixed and re-verified)

### Known limitations (honest)
- **No Playwright test suite:** the delivery environment explicitly prohibits writing test code; verification was performed via automated browser E2E instead (documented above).
- Real NSFW sites are **not** live-integrated: the Wotaku inventory shows essentially no sanctioned APIs; adapters here are local demo repositories. Every adapter slot (search/details/units/streams/health/config) is real and exercised — a licensed API can be wired into the same interface.
- Downloads and SakuraScan health jitter are documented simulations; streams outside the one sample are intentionally absent (licensing), shown honestly in the UI.
- Single-user demo DB (SQLite), English-only, light theme tokens exist in Hikari study but only the dark theme is implemented.

## 8. Safety & policy

Age verification gate on entry · every title carries 18+ content flags ("All depicted characters are fictional adults (18+)" / AV: "All performers are verified adults") · policy page (`#/policy`) codifying adults-only, prohibited-content, licensing-respect, moderation and privacy rules · report dialog on every title persisted to `Report` with per-user report history · no DRM/paywall/auth circumvention anywhere in the codebase · no third-party code execution (scripts are metadata + permission manifests).

## 9. Repository map

```
prisma/schema.prisma        unified DB (21 models)
prisma/seed.ts              14 providers, 49 unified titles, 3,947 pages, demo account (demo/demo1234)
src/lib/content-factory.ts  deterministic unit planning + placeholder URL builders
src/lib/providers/          registry + engine (install/health/config/import/dedup)
src/lib/{auth,api-utils,serialize,category-meta,client-api}.ts
src/app/api/…               24 route handlers (auth, media, search, library, progress,
                            history, collections, reviews, notifications, downloads,
                            providers, chapters, episodes, scripts, databases,
                            recommendations, reports, profile, placeholder, age)
src/components/             shell, providers+auth ctx, age gate, media cards/actions, router (app.tsx)
src/views/                  18 views (home, browse, search, detail, reader, watch, gallery,
                            library, collections, history, downloads, extensions, scripts,
                            databases, profile, settings, policy, source)
public/media/               AI hero art + ffmpeg demo stream
docs/recon/                 Hikari design study + Wotaku inventory + E2E screenshots
```

**Demo account:** `demo` / `demo1234` (or one-click "Sign in" on the home header).
