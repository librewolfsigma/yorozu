# Task 7-b — Frontend workstream B: detail / watch / reader / gallery

Agent: frontend-workstream-B · Date: 2025 session · Status: **DONE**

## Files changed (owned scope only)

1. `src/views/detail.tsx` — rewritten to the `/api/work` contract (visual design preserved: themed hero, tabs, episode/chapter lists, gallery preview, yz-skeleton loading, cta-gradient/hub-soft/card-ring classes).
2. `src/views/watch.tsx` — cinema view on live units; honest no-stream panel; progress via `/api/progress` (kind EPISODE).
3. `src/views/reader.tsx` — webtoon + paged reader over inline `pages[]` or `/api/pages` resolution; progress kind CHAPTER; keyed `ChapterReader` remount per chapter.
4. `src/views/gallery.tsx` — masonry + lightbox viewer for `units.images`; FavoriteButton in header; progress kind GALLERY.

No other files touched (shared components consumed with 7-a's new signatures).

## How units & progress keys resolve

- **Work payload**: `useQuery(["work", provider, id])` → `GET /api/work?p=&id=` (enabled only when both params exist). All four views derive everything from this single payload (units, availability, externalLinks, provider info, library, reviews, popular).
- **Watch**: episode = `units.episodes.find(e => e.key === episodeKey)` falling back to `episodes[0]`. Progress POST `{provider, externalId, category, title, cover, kind:"EPISODE", unitKey: ep.key, unitLabel: "Episode N"|"Scene N", positionSec, completed}` — throttled to every 10 s while playing, on `ended` (completed: true), on unmount/episode-switch (captures that episode's video element + unit), and a manual "Mark as watched". 401/signed-out → swallowed silently (`reportProgress` helper, exported from watch.tsx and reused by reader/gallery).
- **Reader**: chapter = `units.chapters.find(c => c.key === chapterKey)` fallback `chapters[0]`. Chapters normalized **newest-first client-side** (`sort((a,b)=>b.number-a.number)`) because adapters stream ascending (verified: MangaDex returns `[151.5,153,154,155]`); reading order next = index-1, prev = index+1 per the contract. Pages: inline `chapter.pages` used directly; otherwise `useQuery(["pages", provider, chapter.resolveUrl], staleTime 240s)` → `GET /api/pages?p=&url=` → `pages[].imageUrl`. Progress POST `kind:"CHAPTER", unitKey: ch.key, unitLabel:"Chapter N", pageIndex, completed` — deduped per `chapterKey:pageIdx` via ref (webtoon: IntersectionObserver `-20%/-60%`; paged: on page change).
- **Gallery**: progress POST `kind:"GALLERY", unitKey:"gallery", pageIndex: lightboxIndex` when signed in.
- **Detail**: episode rows → `#/watch?p=&id=&ep=<key>`; chapter rows → `#/read?...&ch=<key>`; gallery preview → `#/gallery?p=&id=`. All params `encodeURIComponent`-ed.

## Honesty rules implemented

- `availability.watch=false` + episodes with `streamUrl=null` → "External playback only" note + per-episode badge; watch view with no stream shows the honest panel (externalLinks + ProviderChips), never a fake player.
- No units at all → availability panel: externalLinks buttons + "metadata/directory-only in-app" explanation; `provider.configRequired` → amber warning + `#/extensions` link.
- Chapters with `resolveUrl` get a subtle "loads live from source" hint; pages failure → error + retry + "Open on <provider>".
- Removed dead v1 artifacts: per-image gallery-fav endpoint, DownloadButton/"Offline-ready" badges (downloads removed in v2), age-rating/contentFlags chips (no longer in DTO).

## Deliberate deviations

- `ReviewSection` is fed `rating={work.rating ?? 0}` (7-a's signature is `rating: number`; WorkDTO rating is nullable) and `ratingCount={reviews.length}` (backend ships no aggregate count).
- `ProviderChips` receives `{...provider, externalUrl: work.externalUrl}` (single-provider chip incl. external link, per contract).
- Position restore on episode load skipped — optional per task, and the previous file didn't have it (avoids extra GET `/api/progress` traffic).
- Loading states use `yz-skeleton` blocks (task rule) instead of the old centered spinners; reader page-resolution spinner kept for the async resolve step.
- Chapters/episodes lists are plain sorted arrays, no virtualization (lists are small).

## Verification

- `bunx tsc --noEmit | grep "src/views/(detail|watch|reader|gallery)"` → **0 errors**.
- `bun run lint` → **0 problems** in the four files (remaining warnings are in other agents' files).
- Live smoke tests (dev server + agent-browser):
  - `#/media?p=mangadex&id=e1e38166-…` → hero, chips, actions, tabs, chapters (4) ✓
  - `#/read?…&ch=ch%3A155` → 21 pages resolved live from MangaDex at-home, header "Page 1 / 21" ✓
  - `#/watch?p=rule34video&id=3063279` → proxied stream video + custom controls, "44:01 · via Rule34Video" ✓
  - `#/gallery?p=e621&id=4005902` → masonry, tags, lightbox (Original/Zoom/Close), attribution ✓
- Note: sandbox kills background processes between tool calls; the dev server was booted per-command for tests. Also ran `prisma generate` + `db:push` to fix a stale generated client (`Provider.name` P2022) — environment sync only, no schema edits.
