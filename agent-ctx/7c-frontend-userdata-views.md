# Task 7-c — User-data views (client-first refactor)

Agent: frontend workstream C
Scope: src/views/{library,collections,history,extensions,scripts,databases,profile,settings,policy}.tsx + deletion of src/views/downloads.tsx

## Files changed / deleted

| File | Change |
| --- | --- |
| `src/views/library.tsx` | Rewritten to snapshot-only `work` refs. Entries now `{id,status,progress,score,favorite,notes,updatedAt,work:{provider,externalId,ref,category,title,coverUrl}}`. Cards/rows link via `navigate("/media?p=<enc>&id=<enc>")`. Remove posts `{provider, externalId, remove: true}`. Status tabs still use `counts`. NEW "Continue" strip at top from `GET /api/progress` (deduped, uncompleted, max 14) with kind→link mapping: EPISODE→`#/watch?p&id&ep=<unitKey>`, CHAPTER→`#/read?p&id&ch=<unitKey>`, GALLERY→`#/gallery?p&id`, fallback `#/media?p&id`. Exports shared `RefPoster` poster tile + `mediaHref` (reused by collections/profile to avoid divergent copies of the card look). |
| `src/views/collections.tsx` | Items are now ref-keyed snapshots `{provider,externalId,ref,category,title,coverUrl,addedAt}` (`isPublic` dropped from type). Detail-dialog tiles reuse `RefPoster` + X-remove overlay; remove calls `DELETE /api/collections/<id>/items?provider=&externalId=`. Create/delete collection flows unchanged. |
| `src/views/history.tsx` | Entries snapshot-only with `provider/externalId/ref` (no `mediaSlug`). Rows clickable to `#/media?p=&id=` when `provider+externalId` exist; SEARCH rows still go to `#/search?q=`. "Clear history" DELETE kept. Removed `DOWNLOAD` from ACTION_META (feature deleted). |
| `src/views/extensions.tsx` | Adapted to full ProviderDTO (`videoKind, installed, integration, configRequired, availability{watch,read,view}`; `itemCount`/`live` removed — there is no local catalog). Installed AND repository sections now grouped by category (subheads with category icon/label/count; order follows CATEGORIES). New honest badges: availability chips (Watch #3DB4F2 / Read #3ED6B0 / View #AE8BFF / "External only" when no in-app capability), `videoKind` chip (tooltip = full label), amber "Needs API key" chip + amber-highlighted config dialog when `configRequired`. Integration expander kept; lastError + lastCheckedAt kept; health-check + check-all kept; "Catalog" button renamed "Browse source" → `#/source/<id>`; install/uninstall/toggle/configure unchanged in payload. Uninstall confirm + info-banner copy rewritten for client-first (no "unified database entries" claims). |
| `src/views/scripts.tsx` | Scripts are now `WorkDTO & {install}` live Wotaku entries keyed by `ref`. Install state/actions keyed by `provider`+`externalId` (`POST /api/scripts {provider, externalId, title, action}`) — no more `scriptId`. Removed CatalogItem-only fields (imported flag, version/installs/permission chips, provider.installed gating). Kept: format badge, description, sandbox-policy banner (reworded honestly: tracked bookmark, nothing executes), Switch enable/disable, "Tracked install <timeAgo>" line. Added "Official page" external link (externalUrl) and "from {providerName}" source line; install/uninstall buttons now "Track install"/"Untrack". Empty state when the live directory is unreachable. |
| `src/views/databases.tsx` | `type=databases` renders WorkDTO[] directory cards (title, description, externalUrl Open button, providerName chip, format badge, accent styling, `q` filter param kept). Removed the Tags tab (endpoint no longer exists). `type=stats` now shows Providers/Healthy/Degraded totals, "Installed providers by category" bars (byCategory), and the kept ProviderHealth table (lastError tooltip + lastCheckedAt). Removed old Titles/Chapters/Pages/Episodes/Gallery-images cards, "Most prolific studios" panel, and imported/provider-status per-entry badges. |
| `src/views/profile.tsx` | Uses new `/api/profile` shape (`work` snapshot refs). Favorites grid reuses `RefPoster`. Activity rows are now buttons that open `#/media?p=&id=` when the entry has a `ref` (disabled otherwise, same look). Reports unchanged. |
| `src/views/settings.tsx` | API audit: only auth endpoints used (all still exist) — nothing to degrade. Reader mode + category visibility now persist to `localStorage["yozora_settings"]` (hydrated on mount, written on change; guarded try/catch). "Clear local data" also removes the prefs key and resets UI state. Sign-in blurb no longer mentions downloads. Data-tab footer copy updated to client-first wording. |
| `src/views/policy.tsx` | Verify-only pass. Kept except two stale claims in section 5 that referenced removed features: the named "Site Blocker Plus script" line (now generic tracked-userscript-directory wording) and the "demo content is placeholder art" line (now: content comes live from installed providers, no catalog mirror). The "streams or downloads" phrase in section 3 is a licensing statement, not the removed Downloads feature — left as-is. |
| `src/views/downloads.tsx` | **Deleted** (`rm`). |

## Deliberate deviations

- Shared `RefPoster`/`mediaHref` exported from `library.tsx` and reused in `collections.tsx`/`profile.tsx` (all three are my files) so the poster look stays identical without touching `src/components/`. Uses the same CSS utility classes (poster-card, card-ring, poster-img) and grid template as the old `MediaGrid`.
- Library `year` badge dropped from rows (WorkRef snapshots carry no year); provider id shown instead.
- Repository install button now requires sign-in (toast prompt) — previously it installed anonymously and the backend would 401.
- Extensions "group-by-category" was implemented (the requirement asked to keep it; the old file was flat) while preserving the exact card designs.
- Scripts verb changed to "Track install"/"Untrack" to stay honest per the sandbox policy (nothing is executed or downloaded by Yozora).

## Verification

- `bunx tsc --noEmit 2>&1 | grep -E "src/views/(library|collections|history|extensions|scripts|databases|profile|settings|policy|downloads)\.tsx"` → **zero matches (PASS)**. Full tsc over src/ also clean after the parallel agents' card.tsx/app.tsx updates landed.
- `bun run lint` → remaining problems are ONLY `src/views/reader.tsx` (error) and `src/views/watch.tsx` (warning), both owned by other agents. Zero problems in my files.
- No calls to removed endpoints (`/api/media*`, `/api/downloads*`, `/api/recommendations`, `/api/sync/*`, `/api/gallery-fav`, `/api/episodes/*`, `/api/chapters/*`, `type=tags`).
- dev.log: only recurring error is Prisma P2022 (`Provider.name` column) from the backend schema push — backend workstream's domain, unrelated to these views.
