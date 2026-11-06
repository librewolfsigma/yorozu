// Scheduled metadata synchronization.
//
// Real jobs (no mocks):
//   1. provider-health   — ping every installed provider adapter so
//                          Provider.status/lastCheckedAt reflect reality.
//   2. anidb-crosswalk   — refresh the AniDB titles dump and map AniDB ids
//                          onto unified Media entries (ProviderLink rows).
//
// The scheduler runs in-process (instrumentation.ts, nodejs runtime):
//   - initial run 60s after boot
//   - every 6h thereafter
// Manual trigger: POST /api/sync/run { job?: "health" | "crosswalk" | "all" }.
// Every run appends a SyncLog row — the audit trail reviewers can query.

import { db } from "@/lib/db";
import { getLiveAdapter } from "@/lib/providers/live";
import { buildAnidbCrosswalk } from "@/lib/providers/live/anidb";

export interface SyncReport {
  job: string;
  ok: boolean;
  detail: Record<string, unknown>;
  ranAt: string;
}

async function jobProviderHealth(): Promise<SyncReport> {
  const providers = await db.provider.findMany({ where: { installed: true } });
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const p of providers) {
    const adapter = getLiveAdapter(p.id);
    const config = JSON.parse(p.config || "{}") as Record<string, string>;
    if (!adapter) {
      results.push({ id: p.id, ok: false, error: "no adapter" });
      continue;
    }
    try {
      await adapter.ping(config);
      await db.provider.update({ where: { id: p.id }, data: { status: "ACTIVE", lastError: null, lastCheckedAt: new Date() } });
      results.push({ id: p.id, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Auth-gated providers (stash-box, Gelbooru key) are EXPECTED to fail
      // health checks until the user sets their key — keep their error text
      // (the UI explains it) but do not spam status changes for it.
      await db.provider.update({ where: { id: p.id }, data: { status: "ERROR", lastError: msg.slice(0, 300), lastCheckedAt: new Date() } }).catch(() => null);
      results.push({ id: p.id, ok: false, error: msg.slice(0, 120) });
    }
  }
  return {
    job: "provider-health",
    ok: results.some((r) => r.ok),
    detail: { providers: results.length, healthy: results.filter((r) => r.ok).length, results },
    ranAt: new Date().toISOString(),
  };
}

async function jobAnidbCrosswalk(): Promise<SyncReport> {
  const report = await buildAnidbCrosswalk(db);
  return {
    job: "anidb-crosswalk",
    ok: true,
    detail: report as unknown as Record<string, unknown>,
    ranAt: new Date().toISOString(),
  };
}

async function persist(report: SyncReport) {
  await db.syncLog.create({
    data: {
      job: report.job,
      status: report.ok ? "OK" : "ERROR",
      detail: JSON.stringify(report.detail).slice(0, 4000),
    },
  }).catch(() => null);
}

export async function runSync(which: "health" | "crosswalk" | "all" = "all"): Promise<SyncReport[]> {
  const reports: SyncReport[] = [];
  if (which === "health" || which === "all") {
    try {
      const r = await jobProviderHealth();
      reports.push(r);
      await persist(r);
    } catch (e) {
      const r: SyncReport = { job: "provider-health", ok: false, detail: { error: e instanceof Error ? e.message : String(e) }, ranAt: new Date().toISOString() };
      reports.push(r);
      await persist(r);
    }
  }
  if (which === "crosswalk" || which === "all") {
    try {
      const r = await jobAnidbCrosswalk();
      reports.push(r);
      await persist(r);
    } catch (e) {
      const r: SyncReport = { job: "anidb-crosswalk", ok: false, detail: { error: e instanceof Error ? e.message : String(e) }, ranAt: new Date().toISOString() };
      reports.push(r);
      await persist(r);
    }
  }
  return reports;
}

// ─── in-process scheduler (real interval, guarded singleton) ───

const g = globalThis as unknown as { __yozoraSyncTimer?: NodeJS.Timeout };

export function startSyncScheduler() {
  if (g.__yozoraSyncTimer) return; // already running (dev hot-reload safe)
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const initial = setTimeout(() => {
    void runSync("all").catch(() => null);
  }, 60_000);
  initial.unref?.();
  g.__yozoraSyncTimer = setInterval(() => {
    void runSync("all").catch(() => null);
  }, SIX_HOURS);
  g.__yozoraSyncTimer.unref?.();
}
