import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api-utils";
import { discoverCategory } from "@/lib/providers/engine";
import type { WorkDTO } from "@/lib/serialize";
import { TTL, cached } from "@/lib/cache";

// Aggregate payload for the home view — 100% LIVE provider data.
// Rails are pulled from provider "popular" listings (TTL-cached); the hero
// picks the best real artwork from those same rails. Nothing is persisted.

interface ContinueItem {
  provider: string;
  externalId: string;
  ref: string;
  category: string;
  kind: string;
  unitKey: string;
  unitLabel: string | null;
  positionSec: number | null;
  pageIndex: number | null;
  completed: boolean;
  titleSnapshot: string;
  coverSnapshot: string | null;
  updatedAt: Date;
}

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();

    const RAIL_CATEGORIES = ["ANIME", "MANGA", "MANHWA", "ILLUSTRATION", "AV", "GAME"];
    const discoveries = await Promise.all(
      RAIL_CATEGORIES.map((c) => cached(`home:${c}`, "rails", TTL.RAILS, () => discoverCategory(c)).catch(() => ({ category: c, kind: null, rails: [] }))),
    );

    // Merge rails per category into a single deduped list (external-ref dedup,
    // computed per request — no local index).
    const categories: Record<string, WorkDTO[]> = {};
    const heroPool: WorkDTO[] = [];
    for (const d of discoveries) {
      const merged: WorkDTO[] = [];
      const seen = new Set<string>();
      for (const rail of d.rails) {
        for (const item of rail.items) {
          if (seen.has(item.ref)) continue;
          seen.add(item.ref);
          merged.push(item);
        }
      }
      categories[d.category] = merged.sort((a, b) => b.popularity - a.popularity).slice(0, 14);
      for (const w of merged) {
        if (w.bannerUrl || w.coverUrl) heroPool.push(w);
      }
    }

    const hero = heroPool
      .sort((a, b) => (b.bannerUrl ? 1 : 0) - (a.bannerUrl ? 1 : 0) || b.popularity - a.popularity)
      .slice(0, 8);

    let continue_: ContinueItem[] = [];
    if (user) {
      const rows = await db.progress.findMany({
        where: { userId: user.id, completed: false },
        orderBy: { updatedAt: "desc" },
        take: 12,
      });
      const seen = new Set<string>();
      continue_ = rows
        .filter((r) => {
          const ref = `${r.providerId}:${r.externalId}`;
          if (seen.has(ref)) return false;
          seen.add(ref);
          return true;
        })
        .map((r) => ({
          provider: r.providerId,
          externalId: r.externalId,
          ref: `${r.providerId}:${r.externalId}`,
          category: r.category,
          kind: r.kind,
          unitKey: r.unitKey,
          unitLabel: r.unitLabel,
          positionSec: r.positionSec,
          pageIndex: r.pageIndex,
          completed: r.completed,
          titleSnapshot: r.titleSnapshot,
          coverSnapshot: r.coverSnapshot,
          updatedAt: r.updatedAt,
        }));
    }

    const { listProviders } = await import("@/lib/providers/engine");
    const { installed } = await listProviders();
    const stats = {
      providers: installed.length,
      degraded: installed.filter((p) => p.status === "ERROR").length,
      categories: RAIL_CATEGORIES.length,
    };

    return NextResponse.json({
      hero,
      popular: hero,
      categories,
      continue: continue_,
      stats,
      user: user ? { id: user.id, username: user.username } : null,
    });
  });
}
