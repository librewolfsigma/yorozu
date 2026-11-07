# 7-a — Frontend workstream A (shell, router, shared media components, home/browse/search/source)

## Status: COMPLETE

## Backend contract conformance
All views/components now speak the v2 client-first contract (docs/CLIENT_ARCHITECTURE.md):
- Routes: `#/media?p=&id=`, `#/read?p=&id=&ch=`, `#/watch?p=&id=&ep=`, `#/gallery?p=&id=`, `#/browse/<CAT>?kind=`, `#/search?q=`, `#/source/<providerId>`. Slug routes fully removed.
- Data: WorkDTO everywhere (via `fromDTO`), no MediaDTO/slug/import flow anywhere in my files.
- Endpoints used: `/api/home`, `/api/search`, `/api/discover/<CAT>?kind=`, `/api/providers/<id>?q=&page=`, `/api/library`, `/api/collections/<id>/items`, `/api/reviews`, `/api/reports`.

## Files changed (all verified)
1. `src/components/media/card.tsx` — `MediaCardData` = {provider, externalId, ref, title, coverUrl, category, videoKind?, format?, status?, year?, rating?, popularity, genres?, accent?}; `fromDTO(m: WorkDTO)`; card click/Enter → `navigate(/media?p=&id=)`; added small AV-subcategory badge (videoKindLabel) bottom-right of poster when videoKind set; rating now `number|null` guarded; React keys use `ref`. Also exported `workHref(provider, externalId)` helper. All styling/classes unchanged.
2. `src/components/media/actions.tsx` — reworked to `WorkRefInfo`. `useLibraryMutation(work)` posts {provider, externalId, category, title, cover, ...payload} to /api/library, invalidates ["library"], ["home"], ["work"]. `AddToLibraryButton({work, library, hub})`, `FavoriteButton({work, favorite, hub})`, `CollectionPicker({work, hub, collections})` (POST ref payload; DELETE ?provider=&externalId=), `ReportDialog` unchanged, `ReviewSection({work, reviews, hub, rating, ratingCount})` (POST /api/reviews incl. titleSnapshot; DELETE ?provider=&externalId=), `ProviderChips({provider})` single-provider chip w/ status dot + external link + browse→/source/<id>. `LibraryState` kept. **DownloadButton + Download import deleted.**
3. `src/components/shell.tsx` — removed Downloads nav item + Download icon; search dialog hint now "Search runs live across all installed providers — nothing is stored locally."; everything else untouched.
4. `src/components/app.tsx` — new router parsing `?p=&id=` (`query.get` decodes); passes DetailView {provider,id}, ReaderView {provider,id,chapterKey}, WatchView {provider,id,episodeKey}, GalleryView {provider,id}; fullBleed + lazy + Suspense structure kept; DownloadsView import/route removed entirely.
5. `src/views/home.tsx` — new /api/home payload (hero/popular/categories WorkDTO; continue = {provider,externalId,unitKey,kind,snapshots}); ContinueCard deep-links to /watch?ep= / /read?ch= / /gallery; stats strip = providers/degraded/live categories (no fake counts); hero links ?p=&id=; "N live" on category shortcuts.
6. `src/views/browse.tsx` — GET /api/discover/<CAT>?kind=; one section per rail (provider name + green/red status dot, honest per-rail error text); AV tab bar from VIDEO_KINDS ("", AV, JAV, PMV, HMV, CREATOR) that navigates ?kind=; no facets/filters/sort/search UI; empty state points at Extensions; rail/card visuals kept.
7. `src/views/search.tsx` — GET /api/search?q=&category=; flat providerResults grid with providerName footer badges; category chips re-query with &category=; honest providerErrors panel; empty state honest.
8. `src/views/source.tsx` — Mihon-style: provider header w/ status dot + videoKind chip; configRequired warning linking to Extensions; debounced search; paginated MediaGrid via /api/providers/<id>?q=&page= with Prev/Next; upstream error shown verbatim; per-source state reset.
9. DELETED `src/components/media/import-button.tsx`.

## Verify results
- `bunx tsc --noEmit` filtered to my files: **0 errors** (currently 0 errors repo-wide; earlier transient errors were other agents' in-flight files: detail/profile/downloads, resolved by them).
- `bun run lint`: **0 findings in my files**. Remaining repo lint issue is `src/views/reader.tsx` set-state-in-effect error (owned by workstream B, in flight).

## Notes for other agents
- `card.tsx` exports: MediaCardData, fromDTO, MediaCard{media,width,showRank,rank,hubOverride,footer}, MediaGrid, MediaRail{items,showRank,cardWidth}, MediaCardSkeleton, GridSkeleton, PopularityBadge, InLibraryDot, workHref. Use `footer` prop for extra badges under cards (search uses it for providerName).
- `actions.tsx` exports (consume from detail view): LibraryState, useLibraryMutation(work), AddToLibraryButton{work,library,hub}, FavoriteButton{work,favorite,hub}, CollectionPicker{work,hub,collections}, ReportDialog{targetType,targetId}, ReviewSection{work,reviews,hub,rating,ratingCount}, ProviderChips{provider}.
- Query keys to invalidate after user-data writes: ["library"], ["home"], ["work"] (already handled by useLibraryMutation / ReviewSection).
- Infra note (not mine): dev server logs `P2022 main.Provider.name does not exist` — stale in-memory Prisma Client in the long-running dev process; on-disk schema/db/generated client are in sync (`db push` reports in-sync). Clears on next dev-server restart. UI honestly shows API error states meanwhile.
