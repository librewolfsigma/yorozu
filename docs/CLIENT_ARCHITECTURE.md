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

## 6. AV taxonomy (the AV = JAV correction)

`AV` is the **category**; `videoKind` is the **subcategory**. Per the
user-corrected taxonomy, **AV and JAV are the same thing** — "AV" IS Japanese
Adult Video. The slices that remain distinct:

* `JAV` — the AV category itself (JavDB, r18.dev, XVideos, JAVStash)
* `WESTERN` — western studio scenes (StashDB — optional free API key)
* `CREATOR` — independent/clip-store creators (FansDB)
* `PMV` — porn music video edits (PMVHaven, EPorner rail, PMV Stash)
* `HMV` — hentai music video edits (PMVHaven HMV rail)
* `HENTAI` — adult animation / CG clips (Rule34Video, Hanime1)

Browse/Search render **subcategory tabs** for the AV category and never merge
them into Anime. Metadata ≠ playback: stash-box sources are metadata-only
(free API key required) and say so.

## 6b. No login, ever

Yozora has **no accounts and no login**. `getCurrentUser()` transparently
continues every visitor as this device's local profile (`username: "local"`,
created on first request, unusable random secret). All tracking features —
library, progress, collections, reviews, history — work from the first visit
with zero sign-up friction. The only gate that remains is the 18+ age
confirmation, which is a legal declaration, not an account.

## 6c. Playback resilience

Streams are short-lived signed URLs on most sources, so:

* units cache TTL is 60 s (`TTL.UNITS`) — never serve a stale token
* `/api/img` retries 403/503 with a force-refreshed cookie jar, then falls
  back to a **curl streaming transport** (Range supported, challenge sniffed
  by first byte, cookie refresh through curl itself on rotation)
* redirects are followed **manually with per-hop allowlist validation** on
  both the fetch and curl transports — an allowlisted host can never bounce
  the proxy at an internal address (SSRF)
* upstream metadata responses are **hard-capped at 8 MB** (declared
  `content-length` rejected early; body consumption bounded by a reader loop)
* the player attaches **hls.js** for `.m3u8` streams and renders an honest
  "Try a fresh resolve / Open at source" panel on playback failure — a dead
  stream can never crash the view with NotSupportedError
* stream-CDN hosts that reject the server runtime's TLS fingerprint at
  network level (eporner shards, xvideos CDN, hembed, OVH storage) fall
  through to the same curl streaming transport instead of failing the player

## 6d. Extension repositories (real upstream-manifest sync)

The registry is no longer code-only. Yozora syncs **maintained upstream
extension repositories** at runtime (default:
`librewolfsigma/yozora-extensions` → `index.json`, overridable via
`YOZORA_EXTENSION_REPO_URL` or the Extensions UI):

* a manifest is **data, never code**: declarative recipes (URL templates,
  regex field extractors, JSON dot-paths, string replacement) interpreted by
  `src/lib/providers/ext/engine.ts` — the only operations a recipe can
  trigger are fetch / regex / dot-path / replace, so auto-syncing a
  third-party repository cannot execute anything in the client
* manifests are **validated strictly and adopted whole** — any unknown shape
  rejects the sync
* sync failures are **non-events**: the last-good manifest keeps serving,
  the error is recorded on the `ExtensionRepo` row and shown in Extensions
* extension providers flow through the SAME surfaces as bundled ones —
  listing, install overlay, universal search, discover rails, details,
  reading — and their declared `mediaHosts` join the proxy allowlist only
  while installed + synced
* the provider audit script audits extension adapters exactly like bundled
  ones (`25 ok / 5 config-gated / 0 fail of 30` at time of writing,
  including the HentaiFox extension)

## 7. Honesty matrix (reporting standard)

| Level | Meaning |
| --- | --- |
| REAL | Verified live network call to official/public API or public pages |
| CONFIG-GATED | Real adapter; requires the user's free API key (Gelbooru, stash-box) |
| EXTERNAL-ONLY | No in-app playback/reading; UI opens the provider's official page |
| NOT IMPLEMENTED | Doesn't exist here — never shown as working |
