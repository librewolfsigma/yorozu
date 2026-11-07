// Provider engine — the client-first core (docs/CLIENT_ARCHITECTURE.md).
//
// Yozora is a CLIENT: this module never persists provider results. It
//  - serves the static registry + the user's overlay (install/config/health),
//  - performs LIVE search / discover / details / units / page resolution,
//  - memoizes upstream responses in the bounded TTL cache only.
// Dedup happens per request on external refs — there is no local index.

import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import { PROVIDER_REGISTRY, type ProviderDef } from "./registry";
import { getLiveAdapter } from "./live";
import { ensureExtensionManifests, listExtensionDefs } from "./ext/repo";
import type { LiveAdapter, LiveUnits } from "./live/types";
import { toWorkDTO, dedupeByRef, type WorkDTO } from "@/lib/serialize";
import { cached, TTL } from "@/lib/cache";

// ─── capability declarations (honest: what the adapter really does) ───

const CAN_WATCH = new Set([
  "rule34video", "xvideos", "eporner", "hanime", "pmvhaven", "r18dev",
]);
const CAN_READ = new Set(["mangadex", "ehentai", "manga18fx"]);
const CAN_VIEW = new Set(["e621", "e621-pools", "yandere", "hypnohub", "gelbooru"]);

/**
 * Extension providers derive availability from their declared capabilities
 * — read needs chapters/pages/read, view needs gallery, watch needs
 * scenes/streams. Bundled providers keep their audited static sets.
 */
function capabilitiesFor(def: ProviderDef): { watch: boolean; read: boolean; view: boolean } {
  if (CAN_WATCH.has(def.id) || CAN_READ.has(def.id) || CAN_VIEW.has(def.id)) {
    return { watch: CAN_WATCH.has(def.id), read: CAN_READ.has(def.id), view: CAN_VIEW.has(def.id) };
  }
  const c = new Set(def.capabilities);
  return {
    watch: c.has("scenes") || c.has("streams"),
    read: c.has("chapters") || c.has("pages") || c.has("read"),
    view: c.has("gallery") || c.has("view"),
  };
}

/**
 * Fixed AV subcategory per provider. AV and JAV are THE SAME category
 * (user-corrected taxonomy): Japanese Adult Video. Distinct slices that
 * remain: WESTERN scenes, CREATOR clips, PMV/HMV edits, HENTAI animation.
 */
export const PROVIDER_VIDEO_KIND: Record<string, string> = {
  javdb: "JAV",
  r18dev: "JAV",
  xvideos: "JAV",
  javstash: "JAV",
  stashdb: "WESTERN",
  fansdb: "CREATOR",
  pmvhaven: "PMV",
  pmvstash: "PMV",
  eporner: "PMV", // rail tuned to PMV search; search covers everything
  rule34video: "HENTAI",
  hanime: "HENTAI",
};

export interface ProviderDTO {
  id: string;
  name: string;
  category: string;
  videoKind: string | null;
  description: string;
  version: string;
  author: string;
  homepage: string;
  capabilities: string[];
  configSchema: ProviderDef["configSchema"];
  config: Record<string, string>;
  status: string; // ACTIVE | ERROR | DISABLED
  lastError: string | null;
  lastCheckedAt: Date | null;
  installed: boolean;
  integration: string | null;
  configRequired: boolean; // true when required API keys are not set yet
  availability: { watch: boolean; read: boolean; view: boolean };
}

function overlayToStatus(row: { status: string; lastError: string | null; lastCheckedAt: Date | null; config: string | null; installed: boolean } | null) {
  return {
    status: row?.status ?? "ACTIVE",
    lastError: row?.lastError ?? null,
    lastCheckedAt: row?.lastCheckedAt ?? null,
    config: (row?.config ? JSON.parse(row.config) : {}) as Record<string, string>,
    installed: row?.installed ?? true,
  };
}

function missingRequiredConfig(def: ProviderDef, config: Record<string, string>): string[] {
  return def.configSchema.filter((f) => f.required && !config[f.key]).map((f) => f.label);
}

function defToDTO(def: ProviderDef, row: Parameters<typeof overlayToStatus>[0]): ProviderDTO {
  const s = overlayToStatus(row);
  const missing = missingRequiredConfig(def, s.config);
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    videoKind: PROVIDER_VIDEO_KIND[def.id] ?? null,
    description: def.description,
    version: def.version,
    author: def.author,
    homepage: def.homepage,
    capabilities: def.capabilities,
    configSchema: def.configSchema,
    config: s.config,
    status: !s.installed ? "DISABLED" : missing.length ? "ERROR" : s.status,
    lastError: s.lastError,
    lastCheckedAt: s.lastCheckedAt,
    installed: s.installed,
    integration: getLiveAdapter(def.id)?.integration ?? null,
    configRequired: missing.length > 0,
    availability: capabilitiesFor(def),
  };
}

// ─── listing (registry + overlay; no counts — there is no catalog) ───

export async function listProviders() {
  const [rows, registry] = await Promise.all([db.provider.findMany(), getRegistryDefs()]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const all = registry.map((def) => defToDTO(def, byId.get(def.id) ?? null));
  return {
    installed: all.filter((p) => p.installed),
    repository: all.filter((p) => !p.installed),
  };
}

export async function getProviderDTO(id: string): Promise<{ def: ProviderDef; dto: ProviderDTO; adapter: LiveAdapter | null }> {
  const registry = await getRegistryDefs();
  const def = registry.find((p) => p.id === id);
  if (!def) throw new ApiError(404, `Unknown provider: ${id}`);
  const row = await db.provider.findUnique({ where: { id } });
  return { def, dto: defToDTO(def, row), adapter: getLiveAdapter(id) };
}

/**
 * Effective registry = bundled adapters + providers adopted from synced
 * upstream extension repositories. Extension defs convert to the same
 * ProviderDef shape so everything downstream (listing, search, discover,
 * details, install overlay) treats them identically.
 */
function extDefToProviderDef(e: {
  id: string; name: string; category: string; description: string;
  version: string; author: string; homepage: string; capabilities: string[];
  configSchema: { key: string; label: string; type: string; required?: boolean; help?: string }[];
}): ProviderDef {
  return {
    id: e.id, name: e.name, category: e.category, description: e.description,
    version: e.version, author: e.author || "extension-repo", homepage: e.homepage,
    capabilities: e.capabilities,
    configSchema: (e.configSchema ?? []).map((f) => ({ ...f })),
  };
}

export async function getRegistryDefs(): Promise<ProviderDef[]> {
  await ensureExtensionManifests(); // cold-start fetch; keeps last-good on failure
  const ext = listExtensionDefs().map(extDefToProviderDef);
  const bundledIds = new Set(PROVIDER_REGISTRY.map((p) => p.id));
  return [...PROVIDER_REGISTRY, ...ext.filter((e) => !bundledIds.has(e.id))];
}

function providerOpts(dto: ProviderDTO): SearchOptsX {
  return { config: dto.config };
}
type SearchOptsX = { config: Record<string, string> };

function assertUsable(dto: ProviderDTO) {
  if (!dto.installed) throw new ApiError(409, `${dto.name} is not installed`);
  if (dto.status === "DISABLED") throw new ApiError(409, `${dto.name} is disabled`);
  if (dto.configRequired) {
    throw new ApiError(409, `${dto.name} needs configuration: set the required API key(s) in Extensions first.`);
  }
}

// ─── install / uninstall / toggle / configure (user-owned overlay only) ───

export async function installProvider(id: string) {
  const { def } = await getProviderDTO(id);
  await db.provider.upsert({
    where: { id: def.id },
    create: { id: def.id, installed: true, status: "ACTIVE", config: JSON.stringify({}) },
    update: { installed: true, status: "ACTIVE", lastError: null },
  });
  return { ok: true };
}

export async function uninstallProvider(id: string) {
  await getProviderDTO(id);
  await db.provider.upsert({
    where: { id },
    create: { id, installed: false, status: "DISABLED", config: JSON.stringify({}) },
    update: { installed: false, status: "DISABLED", lastError: null },
  });
  return { ok: true };
}

export async function toggleProvider(id: string) {
  const { dto } = await getProviderDTO(id);
  if (!dto.installed) throw new ApiError(409, "Provider is not installed");
  const next = dto.status === "DISABLED" ? "ACTIVE" : "DISABLED";
  await db.provider.upsert({
    where: { id },
    create: { id, installed: true, status: next, config: JSON.stringify({}) },
    update: { status: next, lastError: null },
  });
  return { ok: true, status: next };
}

export async function configureProvider(id: string, config: Record<string, unknown>) {
  const { def } = await getProviderDTO(id);
  for (const field of def.configSchema) {
    if (field.required && (config[field.key] === undefined || config[field.key] === "")) {
      throw new ApiError(400, `Missing required config: ${field.label}`);
    }
  }
  await db.provider.upsert({
    where: { id },
    create: { id, installed: true, status: "ACTIVE", config: JSON.stringify(config) },
    update: { config: JSON.stringify(config), lastError: null, status: "ACTIVE" },
  });
  return { ok: true };
}

// ─── health check — a REAL upstream request, status stored on the overlay ───

export async function healthCheck(id: string) {
  const { dto, adapter } = await getProviderDTO(id);
  let status = "ACTIVE";
  let lastError: string | null = null;

  if (!dto.installed || dto.status === "DISABLED") {
    status = "DISABLED";
    lastError = "Provider is disabled.";
  } else if (dto.configRequired) {
    status = "ERROR";
    lastError = `Configuration required: set the provider's API key(s) in Extensions. This is expected until you add them — the provider reports it honestly instead of faking results.`;
  } else if (!adapter) {
    status = "ERROR";
    lastError = "No live adapter implementation is registered for this provider.";
  } else {
    try {
      await adapter.ping(dto.config);
    } catch (e) {
      status = "ERROR";
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  await db.provider.upsert({
    where: { id },
    create: { id, installed: dto.installed, status, lastError, lastCheckedAt: new Date(), config: JSON.stringify(dto.config) },
    update: { status, lastError, lastCheckedAt: new Date() },
  });

  // Notify users only on REAL upstream failures — never for missing keys.
  if (status === "ERROR" && !dto.configRequired) {
    const users = await db.user.findMany({ select: { id: true }, take: 50 });
    for (const u of users) {
      await db.notification.create({
        data: {
          userId: u.id, type: "PROVIDER", title: `${dto.name} health check failed`,
          body: (lastError ?? "Unknown error").slice(0, 300), link: "#/extensions",
        },
      }).catch(() => null);
    }
  }

  return { id, status, lastError, lastCheckedAt: new Date() };
}

// ─── LIVE search (single provider) ───

export async function searchOneProvider(def: ProviderDef, dto: ProviderDTO, q: string, page: number): Promise<WorkDTO[]> {
  assertUsable(dto);
  const adapter = getLiveAdapter(def.id);
  if (!adapter) throw new ApiError(500, `No live adapter for ${def.id}`);
  return cached("search", `${def.id}:${q}:${page}`, TTL.SEARCH, async () => {
    const items = await adapter.search(q, { page, ...providerOpts(dto) });
    const cap = capabilitiesFor(def);
    return dedupeByRef(
      items
        .filter((i) => i.externalId && i.title)
        .slice(0, 24)
        .map((i) => toWorkDTO(i, { id: def.id, name: def.name, canWatch: cap.watch, canRead: cap.read, canView: cap.view })),
    );
  });
}

/** Unified search across every usable provider in scope. Never persists. */
export async function searchProviders(opts: { q: string; category?: string; providers?: string[]; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q.trim();
  const { installed } = await listProviders();
  let scope = installed;
  if (opts.category) scope = scope.filter((p) => p.category === opts.category);
  if (opts.providers?.length) scope = scope.filter((p) => opts.providers!.includes(p.id));

  const settled = await Promise.all(
    scope.map(async (p) => {
      try {
        const registry = await getRegistryDefs();
        const items = await searchOneProvider(
          registry.find((d) => d.id === p.id) ?? { id: p.id, name: p.name, category: p.category, description: "", version: "", author: "", homepage: "", capabilities: [], configSchema: [] },
          p,
          q,
          page,
        );
        return {
          provider: { id: p.id, name: p.name, status: p.status, videoKind: p.videoKind, availability: p.availability, configRequired: p.configRequired },
          items,
          error: null as string | null,
        };
      } catch (e) {
        return {
          provider: { id: p.id, name: p.name, status: p.status, videoKind: p.videoKind, availability: p.availability, configRequired: p.configRequired },
          items: [] as WorkDTO[],
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }),
  );

  const ok = settled.filter((s) => !s.error);
  return {
    q,
    page,
    providerResults: settled.flatMap((s) => s.items),
    groups: Object.fromEntries(
      ok.map((s) => [s.provider.id, { provider: s.provider, items: s.items }]),
    ),
    providerErrors: settled.filter((s) => s.error).map((s) => ({ provider: s.provider.name, error: s.error })),
    total: settled.reduce((n, s) => n + s.items.length, 0),
  };
}

// ── discover rails — live popular listings, TTL-cached, never persisted ──

export async function discoverCategory(category: string, kind?: string) {
  const { installed } = await listProviders();
  let scope = installed.filter((p) => p.category === category);
  if (kind) {
    if (kind === "HMV") {
      // HMV edits live on PMV platforms alongside PMV — pmvhaven serves its
      // HMV rail via opts.kind; pmvstash (key-gated) keeps PMV listing.
      scope = scope.filter((p) => PROVIDER_VIDEO_KIND[p.id] === "PMV");
    } else {
      scope = scope.filter((p) => PROVIDER_VIDEO_KIND[p.id] === kind);
    }
  }

  const rails: { providerId: string; providerName: string; videoKind: string | null; items: WorkDTO[]; error: string | null }[] = [];
  await Promise.all(
    scope.map(async (p) => {
      const adapter = getLiveAdapter(p.id);
      try {
        if (!adapter?.popular) throw new ApiError(501, `${p.name} exposes no popular listing (search-only source)`);
        assertUsable(p);
        const items = await cached("rails", `${p.id}:1:${kind ?? ""}`, TTL.RAILS, () => adapter.popular!({ page: 1, kind }));
        rails.push({
          providerId: p.id,
          providerName: p.name,
          videoKind: p.videoKind,
          items: dedupeByRef(
            items.slice(0, 24).map((i) => toWorkDTO(i, { id: p.id, name: p.name, canWatch: p.availability.watch, canRead: p.availability.read, canView: p.availability.view })),
          ),
          error: null,
        });
      } catch (e) {
        rails.push({
          providerId: p.id, providerName: p.name, videoKind: p.videoKind, items: [],
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }),
  );
  return { category, kind: kind ?? null, rails };
}

/**
 * Paged feed for one category — the engine behind infinite scroll.
 *
 * Every usable provider in scope contributes its page-N listing (search when
 * `q` is set, popular otherwise); results are interleaved round-robin and
 * deduped on external refs per request. Nothing is persisted — each page is
 * a live upstream fetch behind the bounded TTL cache, so NEW upstream items
 * surface on the next page pull after cache expiry.
 */
export async function feedCategory(opts: {
  category: string;
  kind?: string;
  q?: string;
  page?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const q = (opts.q ?? "").trim();
  const { installed } = await listProviders();
  let scope = installed.filter((p) => p.category === opts.category);
  if (opts.kind) {
    if (opts.kind === "HMV") {
      scope = scope.filter((p) => PROVIDER_VIDEO_KIND[p.id] === "PMV");
    } else {
      scope = scope.filter((p) => PROVIDER_VIDEO_KIND[p.id] === opts.kind);
    }
  }

  const registry = await getRegistryDefs();
  const perProvider: { id: string; name: string; error: string | null; count: number; items: WorkDTO[] }[] = [];
  await Promise.all(
    scope.map(async (p) => {
      const def = registry.find((d) => d.id === p.id);
      const adapter = getLiveAdapter(p.id);
      try {
        assertUsable(p);
        if (!adapter) throw new ApiError(501, "no live adapter installed");
        const cap = capabilitiesFor(def ?? { id: p.id, name: p.name, category: p.category, description: "", version: "", author: "", homepage: "", capabilities: [], configSchema: [] });
        const fetcher = async () => {
          if (q) {
            if (!adapter.search) throw new ApiError(501, "source has no text search upstream");
            return adapter.search(q, { page, ...providerOpts(p) });
          }
          if (!adapter.popular) throw new ApiError(501, "source exposes no popular listing (search-only — use search)");
          return adapter.popular({ page, kind: opts.kind });
        };
        const raw = await cached("feed", `${p.id}:${q}:${page}:${opts.kind ?? ""}`, TTL.RAILS, fetcher);
        const items = dedupeByRef(
          raw
            .filter((i) => i.externalId && i.title)
            .slice(0, 40)
            .map((i) => toWorkDTO(i, { id: p.id, name: p.name, canWatch: cap.watch, canRead: cap.read, canView: cap.view })),
        );
        perProvider.push({ id: p.id, name: p.name, error: null, count: items.length, items });
      } catch (e) {
        perProvider.push({ id: p.id, name: p.name, error: e instanceof Error ? e.message : String(e), count: 0, items: [] });
      }
    }),
  );

  // round-robin interleave — every source gets fair representation on every page
  const queues = perProvider.filter((s) => !s.error).map((s) => [...s.items].sort((a, b) => b.popularity - a.popularity));
  const merged: WorkDTO[] = [];
  const seen = new Set<string>();
  for (let depth = 0; queues.some((qq) => qq.length > 0) && merged.length < 120; depth++) {
    for (const qq of queues) {
      const item = qq.shift();
      if (!item || seen.has(item.ref)) continue;
      seen.add(item.ref);
      merged.push(item);
    }
  }

  const liveCount = perProvider.filter((s) => !s.error && s.count > 0).length;
  return {
    category: opts.category,
    kind: opts.kind ?? null,
    q,
    page,
    items: merged,
    hasMore: liveCount > 0 && merged.length >= Math.min(10, page * 4),
    providers: perProvider.map(({ id, name, error, count }) => ({ id, name, error, count })),
  };
}

// ─── work details + units — resolved live on demand ───

export async function getWork(providerId: string, externalId: string, opts?: { freshUnits?: boolean }) {
  const { def, dto, adapter } = await getProviderDTO(providerId);

  const availability = capabilitiesFor(def);
  const mkDTO = (i: Parameters<typeof toWorkDTO>[0]) =>
    toWorkDTO(i, { id: def.id, name: def.name, canWatch: availability.watch, canRead: availability.read, canView: availability.view });

  let work: WorkDTO | null = null;
  if (adapter?.details) {
    assertUsable(dto);
    work = await cached("details", `${def.id}:${externalId}`, TTL.WORK, () =>
      adapter.details!(externalId, providerOpts(dto)).then((d) => (d ? mkDTO(d) : null)),
    ).catch((e) => {
      if (e instanceof ApiError) throw e;
      throw new ApiError(502, `${def.name}: ${e instanceof Error ? e.message : String(e)}`);
    });
  }
  if (!work) {
    // Honest minimal fallback for providers without per-item details
    // (e.g. Moebooru boards): identity + capability only, no invented metadata.
    work = mkDTO({
      externalId,
      title: `Item ${externalId}`,
      category: def.category,
      videoKind: PROVIDER_VIDEO_KIND[def.id],
      externalUrl: adapter ? undefined : null,
      extra: { minimal: true },
    });
  }

  let units: LiveUnits | null = null;
  if (adapter?.units) {
    assertUsable(dto);
    // Units carry PLAYABLE URLs that are often short-lived signed tokens
    // (KVS get_file, xvideos secure links, eporner XHR). Cache them briefly —
    // a stale token is exactly what breaks playback with expired-URL 403s.
    // `freshUnits` skips the cache read entirely — the player's mid-stream
    // recovery uses it to force a genuinely NEW resolve (the cached token
    // may be the one that just died, e.g. after an egress IP rotation).
    units = opts?.freshUnits
      ? await adapter.units!(externalId).catch(() => null)
      : await cached("units", `${def.id}:${externalId}`, TTL.UNITS, () => adapter.units!(externalId)).catch(() => null);
  }

  // "Popular on <provider>" rail (replaces the old local recommendations table)
  let popular: WorkDTO[] = [];
  if (adapter?.popular) {
    popular = await cached("rails", `${def.id}:1`, TTL.RAILS, () => adapter.popular!({ page: 1 }))
      .then((items) => dedupeByRef(items.slice(0, 12).map(mkDTO)).filter((w) => w.ref !== work!.ref))
      .catch(() => []);
  }

  return { work, units, popular, provider: { id: def.id, name: def.name, status: dto.status, configRequired: dto.configRequired, availability } };
}

export async function resolvePages(providerId: string, sourceUrl: string): Promise<{ idx: number; imageUrl: string }[]> {
  const { def, dto, adapter } = await getProviderDTO(providerId);
  if (!adapter?.resolveChapter) throw new ApiError(501, `${def.name} does not support on-demand page resolution`);
  assertUsable(dto);
  return cached("pages", `${def.id}:${sourceUrl}`, TTL.PAGES, async () => {
    const images = await adapter.resolveChapter!(sourceUrl);
    if (!images.length) throw new ApiError(502, `${def.name} returned no pages for this chapter`);
    return images.map((imageUrl, idx) => ({ idx, imageUrl }));
  });
}
