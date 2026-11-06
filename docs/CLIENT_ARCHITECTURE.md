# Yozora — Client-First Architecture (v2)

> **YOZORA IS A CLIENT, NOT A DATABASE.**
> Upstream providers maintain the content and the metadata; Yozora presents
> them in one place. Yozora stores only user-owned data.

This document is the binding architecture specification after the v2 audit.
It has two parts: (1) the audit — what was removed and why, (2) the API
contract every view and route must follow.

---

## 1. Audit findings (what violated the client-first requirement)

| Violation | Where it was | Action |
| --- | --- | --- |
| Persistent catalog mirror (`CatalogItem` rows written on every search/discover) | `src/lib/providers/engine.ts` → `upsertLiveItems` | **Removed.** Search/discover now streams live results through a bounded in-memory TTL cache. Nothing is persisted. |
| Unified metadata database (`Media` + `ProviderLink`, slug space, dedup index) | `Media`, `ProviderLink` models, `importCatalogItem`, `importLightweight` | **Removed.** Dedup happens per-request using external IDs (`provider:externalId`), never a local index. |
| Materialized content units (`Episode`/`Chapter`/`ChapterPage`/`GalleryImage`) | schema + `importCatalogItem` + `/api/chapters/[id]` + `/api/episodes/[id]` | **Removed.** Units resolve live from the provider adapter on demand (`/api/work`, `/api/pages`) and live only in the TTL cache. |
| Local people/characters/tag taxonomy (`Character`, `Person`, `MediaCharacter`, `MediaPerson`, `TagDef`) | schema | **Removed** (were already empty; tables dropped). |
| Background catalog maintenance (6h scheduler, SyncLog audit trail, AniDB→ProviderLink crosswalk) | `src/lib/sync.ts`, `instrumentation.ts`, `buildAnidbCrosswalk` | **Removed.** No background processes, no catalog imports. Provider health is checked on demand (Extensions view / before search). |
| DB-backed browse/facets/recommendations (`/api/media`, `/api/recommendations`) | routes | **Removed.** Browse = live provider listings; "recommended" = live *popular on provider* rails. |
| Download manager rows (`Download`, `/api/downloads`) | schema + routes | **Removed.** External downloadables open directly (magnet links, official store pages). Yozora is not a download queue. |
| Gallery favorite duplication (`GalleryFavorite`) | schema | **Removed** — the unified library favorite covers it. |
| Catalog-backed script/database browsers | `/api/scripts`, `/api/databases` | **Rewritten** to call the live Wotaku adapters per request (TTL-cached). |

## 2. What Yozora stores (and nothing else)

* **Users & sessions** (auth, age verification)
* **Extension configuration** (`Provider` rows: installed/enabled/user API keys/health status)
* **Library entries, favorites, collections** — keyed by external ref `(providerId, externalId)` with a display snapshot (title/cover) so the library renders without re-fetching. These are *bookmarks*, not a metadata database.
* **Progress / history** — reading & watching positions keyed by external ref
* **Reviews** (user notes about an external work), **reports**, **notifications**, **script installs**

No media catalog. No metadata mirror. No content units. No download queue.

## 3. Caching

`src/lib/cache.ts` — bounded in-memory TTL cache (max entries, per-namespace TTL,
LRU-ish eviction). Used ONLY for upstream response memoization:
search/discover (5 min), work details (5 min), units (5 min), resolved pages
(5 min — MangaDex at-home URLs expire ~15 min so this is strictly shorter).
Clearing the cache loses nothing; all data is refetchable from upstream.

## 4. External reference format

Every external work is addressed by `(provider, externalId)`:

* `ref` = `provider:externalId` (React keys, library dedup)
* URLs carry `?p=<provider>&id=<externalId>` (both URL-encoded)

Hash routes: `#/media?p=&id=`, `#/read?p=&id=&ch=`, `#/watch?p=&id=&ep=`,
`#/gallery?p=&id=`, `#/browse/<CAT>?kind=`, `#/search?q=`, `#/source/<providerId>`.

## 5. API contract

### DTOs (`src/lib/serialize.ts`)

```ts
interface WorkDTO {
  provider: string; providerName: string; externalId: string; ref: string;
  title: string; altTitles: string[]; description: string | null;
  coverUrl: string | null; bannerUrl: string | null;
  accent: string; accent2: string;             // always derived, never null
  category: string;                             // ANIME|MANGA|MANHWA|ILLUSTRATION|AV|GAME|SCRIPT|MISC|DATABASE
  videoKind: string | null;                     // AV|JAV|PMV|HMV|CREATOR (never merged into ANIME)
  format: string | null; status: string | null; year: number | null;
  rating: number | null; popularity: number;
  genres: string[]; tags: string[];
  studio: string | null; creator: string | null;
  externalUrl: string | null;
  externalLinks: { label: string; url: string }[];
  availability: { watch: boolean; read: boolean; view: boolean }; // in-app capable
  extra: Record<string, unknown>;
}
interface EpisodeUnitDTO { key: string; number: number; title: string | null; thumbnailUrl: string | null; durationSec: number | null; streamUrl: string | null; streamType: string | null; summary: string | null; }
interface ChapterUnitDTO { key: string; number: number; title: string | null; pageCount: number | null; resolveUrl: string; } // resolveUrl → /api/pages
interface GalleryImageDTO { url: string; thumbUrl: string | null; width: number; height: number; tags: string[]; }
interface UnitsDTO { episodes: EpisodeUnitDTO[]; chapters: ChapterUnitDTO[]; images: GalleryImageDTO[]; }
```

`availability.watch/read/view` is derived **honestly** from what the provider
adapter actually implements (e.g. Rule34Video = watch; MangaDex/E-Hentai/
Manga18fx = read; boorus = view; Sukebei = magnet/open only; stash-box =
metadata/open only). A `false` means the UI must show the external action,
never a fake player.

### Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/home` | GET | `{ hero, categories, continue, stats, user }` — all live rails (TTL-cached), continue = user progress |
| `/api/search?q=&category=&providers=` | GET | Live fan-out; `{ q, total, providerResults: [{provider, items, error}], providerErrors }` |
| `/api/discover/<CAT>?kind=&page=` | GET | `{ category, kind, rails: [{providerId, providerName, videoKind, items, error?}] }` |
| `/api/work?p=&id=` | GET | `{ work, units, externalLinks, library, myCollections, reviews, popular: WorkDTO[] }` — everything live |
| `/api/pages?p=&url=` | GET | `{ pages: [{idx, imageUrl}] }` — lazy chapter resolution via `adapter.resolveChapter` |
| `/api/providers` | GET/POST | List (registry+overlay) / install·uninstall·toggle·configure·health |
| `/api/providers/<id>?q=&page=` | GET | Live source browsing (Mihon-style) |
| `/api/library` | GET/POST | Status-based entries keyed by external ref |
| `/api/progress` | GET/POST | Continue-watching/reading; POST auto-creates library entry |
| `/api/history` | GET/POST/DELETE | Snapshot-only history |
| `/api/collections`, `/api/collections/<id>`, `/api/collections/<id>/items` | CRUD | Keyed by external ref |
| `/api/reviews` | GET/POST/DELETE | Keyed by external ref |
| `/api/scripts` | GET/POST | Live Wotaku scripts + install overlay |
| `/api/databases?type=databases\|stats` | GET | Live Wotaku databases / provider health stats |
| `/api/img?u=` | GET | Strict-allowlist media proxy with Range support (attribution headers) |
| `/api/auth/*`, `/api/age`, `/api/profile`, `/api/notifications`, `/api/reports`, `/api/placeholder` | — | User-owned, unchanged |

**Deleted routes:** `/api/media*`, `/api/media/import`, `/api/episodes/[id]`,
`/api/chapters/[id]`, `/api/downloads*`, `/api/recommendations`,
`/api/sync/run`, `/api/gallery-fav`.

## 6. AV taxonomy (the AV ≠ JAV fix)

`AV` is the **category**; `videoKind` is the **subcategory**:

* `AV` — general / Western adult video & adult animation (Rule34Video, StashDB)
* `JAV` — Japanese adult video (JAVStash) — its own subcategory, never blended
* `PMV` — porn music videos (PMV Stash)
* `HMV` — hentai music videos (matched from PMV Stash tags)
* `CREATOR` — independent/clip-store creators (FansDB)

Browse/Search render **subcategory tabs** for the AV category and never merge
them into Anime. Metadata ≠ playback: stash-box sources are metadata-only
(free API key required) and say so.

## 7. Honesty matrix (reporting standard)

| Level | Meaning |
| --- | --- |
| REAL | Verified live network call to official/public API or public pages |
| CONFIG-GATED | Real adapter; requires the user's free API key (Gelbooru, stash-box) |
| EXTERNAL-ONLY | No in-app playback/reading; UI opens the provider's official page |
| NOT IMPLEMENTED | Doesn't exist here — never shown as working |
