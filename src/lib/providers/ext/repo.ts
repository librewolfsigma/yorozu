// Extension repository sync — connects Yozora to MAINTAINED UPSTREAM
// extension repositories (GitHub manifests) and keeps their providers
// available without app changes.
//
// Design:
//  - The manifest is DATA and is fetched from a user-configurable URL
//    (default: the yozora-extensions repo's raw index.json).
//  - The fetched manifest is validated STRICTLY (./types) and rejected whole
//    on any unknown shape — a hostile or broken upstream can never inject
//    executable content, because recipes are only ever interpreted by
//    ./engine as fetch/regex/replace operations.
//  - The last-good manifest is cached in memory (bounded TTL); sync state
//    (lastSyncedAt / lastError / providerCount / content hash) is persisted
//    in the ExtensionRepo table so the Extensions UI can show health.
//  - A failed sync NEVER evicts the last-good cache: providers keep working
//    until a NEW valid manifest replaces them.

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { invalidateNamespace } from "@/lib/cache";
import { liveJson } from "../live/http";
import { adapterFromRecipe } from "./engine";
import { MANIFEST_VERSION, validateManifest, type ExtManifest, type ExtProviderDef } from "./types";
import type { LiveAdapter } from "../live/types";

export const DEFAULT_EXTENSION_REPO_ID = "yozora-extensions";
export const DEFAULT_EXTENSION_REPO_URL =
  process.env.YOZORA_EXTENSION_REPO_URL ??
  "https://raw.githubusercontent.com/librewolfsigma/yozora-extensions/main/index.json";

export interface RepoState {
  id: string;
  url: string;
  manifest: ExtManifest | null;
  fetchedAt: number | null;
}

const REPO_TTL_MS = 6 * 60 * 60 * 1000; // 6h — extensions change slowly
const states = new Map<string, RepoState>();

function getState(id: string, url: string): RepoState {
  let s = states.get(id);
  if (!s) {
    s = { id, url, manifest: null, fetchedAt: null };
    states.set(id, s);
  }
  return s;
}

// ─── DB overlay (sync health only — the catalog never lives here) ───

export async function ensureRepoRow(id = DEFAULT_EXTENSION_REPO_ID, url = DEFAULT_EXTENSION_REPO_URL) {
  const row = await db.extensionRepo.findUnique({ where: { id } });
  if (row) return row;
  return db.extensionRepo.create({ data: { id, url } }).catch(() =>
    db.extensionRepo.findUnique({ where: { id } }),
  );
}

export interface SyncResult {
  id: string;
  url: string;
  ok: boolean;
  providerCount: number;
  version: string | null;
  error: string | null;
  changed?: boolean;
}

/** Fetch + validate + adopt a manifest. Always fetches; TTL gating for
 *  background refresh lives in ensureExtensionManifests. */
export async function syncExtensionRepo(id = DEFAULT_EXTENSION_REPO_ID, urlOverride?: string): Promise<SyncResult> {
  const row = await ensureRepoRow(id);
  const url = urlOverride ?? row?.url ?? DEFAULT_EXTENSION_REPO_URL;
  const state = getState(id, url);

  try {
    const raw = await liveJson<unknown>(url, {
      timeoutMs: 20_000,
      ua: "YozoraPlatform/1.0 (extension sync)",
      cacheTtlMs: null,
      headers: { Accept: "application/json" },
    });

    // Version gate before full validation (cheap rejection of unknown futures).
    const declared = (raw as { manifestVersion?: unknown })?.manifestVersion;
    if (declared !== MANIFEST_VERSION) {
      throw new Error(`upstream manifest version ${String(declared)} not supported (this build speaks v${MANIFEST_VERSION})`);
    }
    const v = validateManifest(raw);
    if (!v.ok) throw new Error(`manifest rejected: ${v.error}`);

    const manifestHash = createHash("sha256").update(JSON.stringify(v.manifest.providers)).digest("hex").slice(0, 12);
    const changed = !state.manifest || manifestHash !== lastHashes.get(id);
    state.manifest = v.manifest;
    state.fetchedAt = Date.now();
    lastHashes.set(id, manifestHash);

    // The provider set actually changed → discovery caches built from the
    // old set are stale by definition. Bust them so rails reflect reality.
    if (changed) {
      invalidateNamespace("rails");
      invalidateNamespace("home");
    }

    await db.extensionRepo.upsert({
      where: { id },
      create: {
        id, url, installed: true, lastSyncedAt: new Date(), lastError: null,
        contentHash: manifestHash, providerCount: v.manifest.providers.length,
      },
      update: {
        url, lastSyncedAt: new Date(), lastError: null,
        contentHash: manifestHash, providerCount: v.manifest.providers.length,
      },
    });

    return {
      id, url, ok: true,
      providerCount: v.manifest.providers.length,
      version: v.manifest.updated ?? manifestHash,
      error: null,
      changed,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // last-good cache is kept — only the health row records the failure.
    await db.extensionRepo.upsert({
      where: { id },
      create: { id, url, installed: true, lastError: msg.slice(0, 300), providerCount: state.manifest?.providers.length ?? 0 },
      update: { url, lastError: msg.slice(0, 300) },
    }).catch(() => null);
    return { id, url, ok: false, providerCount: state.manifest?.providers.length ?? 0, version: null, error: msg };
  }
}

const lastHashes = new Map<string, string>();

/** Populate caches on first use after a cold start (non-fatal on failure). */
export async function ensureExtensionManifests(): Promise<void> {
  const fresh = [...states.values()].some((s) => s.manifest && s.fetchedAt && Date.now() - s.fetchedAt < REPO_TTL_MS);
  if (fresh) return;
  try {
    const rows = await db.extensionRepo.findMany({ where: { installed: true } });
    const targets = rows.length
      ? rows.map((r) => ({ id: r.id, url: r.url }))
      : [{ id: DEFAULT_EXTENSION_REPO_ID, url: DEFAULT_EXTENSION_REPO_URL }];
    for (const t of targets) {
      const s = getState(t.id, t.url);
      if (s.manifest && s.fetchedAt && Date.now() - s.fetchedAt < REPO_TTL_MS) continue;
      await syncExtensionRepo(t.id, t.url); // keeps last-good on failure
    }
  } catch {
    // Never break the app because the extension repo is unreachable.
  }
}

// ─── registry surface ───

export function listExtensionDefs(): ExtProviderDef[] {
  return [...states.values()].flatMap((s) => s.manifest?.providers ?? []);
}

export function getExtensionDef(id: string): ExtProviderDef | null {
  for (const s of states.values()) {
    const p = s.manifest?.providers.find((x) => x.id === id);
    if (p) return p;
  }
  return null;
}

export function getExtensionAdapter(id: string): LiveAdapter | null {
  const def = getExtensionDef(id);
  return def ? adapterFromRecipe(def) : null;
}

/** Hosts allowlisted for media proxying — ONLY from installed, synced manifests. */
const extMediaHosts = new Set<string>();
const extMediaSuffixes = new Set<string>();
const extResilientHosts = new Set<string>();

export function refreshMediaAllowlist(): void {
  extMediaHosts.clear();
  extMediaSuffixes.clear();
  extResilientHosts.clear();
  for (const def of listExtensionDefs()) {
    for (const h of def.mediaHosts ?? []) extMediaHosts.add(h.toLowerCase());
    for (const s of def.mediaHostSuffixes ?? []) extMediaSuffixes.add(s.toLowerCase());
    if (def.resilientMedia) {
      for (const h of def.mediaHosts ?? []) extResilientHosts.add(h.toLowerCase());
      for (const s of def.mediaHostSuffixes ?? []) extResilientHosts.add(s.toLowerCase());
    }
  }
}

export function isExtensionMediaHost(hostname: string): boolean {
  if (extMediaHosts.has(hostname) || [...extMediaSuffixes].some((s) => hostname.endsWith(s))) return true;
  // Cold start: consult cached manifests directly if the hot set is empty.
  if (extMediaHosts.size === 0 && extMediaSuffixes.size === 0) {
    for (const def of listExtensionDefs()) {
      if (def.mediaHosts?.includes(hostname)) return true;
      if (def.mediaHostSuffixes?.some((s) => hostname.endsWith(s))) return true;
    }
  }
  return false;
}

export function isExtensionResilientHost(hostname: string): boolean {
  if (extResilientHosts.has(hostname)) return true;
  return extResilientHosts.size > 0 && [...extResilientHosts].some((s) => s.startsWith(".") && hostname.endsWith(s));
}

// Keep the hot media allowlist in step after every sync (success keeps it
// current; failure keeps the previous allowlist — matching the last-good
// manifest that stays in force).
const _origSync = syncExtensionRepo;
export async function syncExtensionRepoAndRefresh(id?: string, url?: string): Promise<SyncResult> {
  const r = await _origSync(id, url);
  refreshMediaAllowlist();
  return r;
}

export interface RepoInfo {
  id: string;
  url: string;
  installed: boolean;
  providerCount: number;
  lastSyncedAt: Date | null;
  lastError: string | null;
  contentHash: string | null;
  live: boolean; // manifest present in memory
  providers: { id: string; name: string; category: string; version: string; capabilities: string[] }[];
}

export async function listRepoInfo(): Promise<RepoInfo[]> {
  await ensureRepoRow();
  const rows = await db.extensionRepo.findMany({ orderBy: { id: "asc" } });
  const infos: RepoInfo[] = [];
  for (const r of rows) {
    const state = states.get(r.id);
    const manifest = state?.manifest ?? null;
    infos.push({
      id: r.id,
      url: r.url,
      installed: r.installed,
      providerCount: manifest?.providers.length ?? r.providerCount ?? 0,
      lastSyncedAt: r.lastSyncedAt,
      lastError: r.lastError,
      contentHash: r.contentHash,
      live: !!manifest,
      providers: (manifest?.providers ?? []).map((p) => ({
        id: p.id, name: p.name, category: p.category, version: p.version, capabilities: p.capabilities,
      })),
    });
  }
  return infos;
}
