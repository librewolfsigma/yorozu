import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

// Progress sync from reader/player. Keyed by the EXTERNAL ref + unitKey.
// POST also seeds a library entry (IN_PROGRESS) so "continue" works everywhere.
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to track progress.");
    const rows = await db.progress.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    const seen = new Set<string>();
    const recent = rows
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
    return NextResponse.json({ recent });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to track progress.");
    const body = await readJson<{
      provider?: string; externalId?: string; category?: string; title?: string; cover?: string;
      kind?: string; unitKey?: string; unitLabel?: string;
      positionSec?: number; pageIndex?: number; completed?: boolean;
    }>(req);
    const { provider, externalId, kind, unitKey } = body;
    if (!provider || !externalId || !kind || !unitKey) {
      throw new ApiError(400, "provider, externalId, kind and unitKey are required");
    }
    if (!body.title) throw new ApiError(400, "title snapshot is required (client passes the work title it already loaded)");

    const completed = body.completed ?? false;
    const progress = await db.progress.upsert({
      where: { userId_providerId_externalId_unitKey: { userId: user.id, providerId: provider, externalId, unitKey } },
      create: {
        userId: user.id, providerId: provider, externalId,
        category: body.category ?? "MISC",
        kind, unitKey, unitLabel: body.unitLabel ?? null,
        titleSnapshot: body.title, coverSnapshot: body.cover ?? null,
        positionSec: body.positionSec ?? null,
        pageIndex: body.pageIndex ?? null,
        completed,
      },
      update: {
        positionSec: body.positionSec ?? undefined,
        pageIndex: body.pageIndex ?? undefined,
        completed: completed || undefined,
        unitLabel: body.unitLabel ?? undefined,
      },
    });

    // auto-seed the library entry so the title shows in "In progress"
    const entryWhere = { userId_providerId_externalId: { userId: user.id, providerId: provider, externalId } };
    const entry = await db.libraryEntry.findUnique({ where: entryWhere });
    if (!entry) {
      await db.libraryEntry.create({
        data: {
          userId: user.id, providerId: provider, externalId,
          category: body.category ?? "MISC",
          titleSnapshot: body.title, coverSnapshot: body.cover ?? null,
          status: "IN_PROGRESS",
        },
      });
    }

    return NextResponse.json({ ok: true, progress: { unitKey: progress.unitKey, completed: progress.completed } });
  });
}
