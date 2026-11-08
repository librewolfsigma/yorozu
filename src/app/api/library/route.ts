import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

// Personal library — user-owned bookmarks keyed by the EXTERNAL ref
// (providerId, externalId). The snapshot fields are display caches only.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to view your library.");
    const status = req.nextUrl.searchParams.get("status");
    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;
    const entries = await db.libraryEntry.findMany({ where, orderBy: { updatedAt: "desc" } });
    const all = await db.libraryEntry.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { _all: true },
    });
    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        status: e.status,
        progress: e.progress,
        score: e.score,
        favorite: e.favorite,
        notes: e.notes,
        updatedAt: e.updatedAt,
        work: {
          provider: e.providerId,
          externalId: e.externalId,
          ref: `${e.providerId}:${e.externalId}`,
          category: e.category,
          title: e.titleSnapshot,
          coverUrl: e.coverSnapshot,
        },
      })),
      counts: Object.fromEntries(all.map((g) => [g.status, g._count._all])),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to manage your library.");
    const body = await readJson<{
      provider?: string; externalId?: string; category?: string; title?: string; cover?: string;
      status?: string; score?: number | null; favorite?: boolean; notes?: string | null; remove?: boolean;
    }>(req);
    if (!body.provider || !body.externalId) throw new ApiError(400, "provider and externalId are required");
    const refWhere = { userId: user.id, providerId: body.provider, externalId: body.externalId };
    const where = { userId_providerId_externalId: refWhere };

    if (body.remove) {
      await db.libraryEntry.deleteMany({ where: refWhere });
      return NextResponse.json({ removed: true });
    }

    const existing = await db.libraryEntry.findUnique({ where });
    if (!existing && (!body.title || !body.category)) {
      throw new ApiError(400, "title and category snapshots are required for new entries");
    }

    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.score !== undefined) data.score = body.score;
    if (body.favorite !== undefined) data.favorite = body.favorite;
    if (body.notes !== undefined) data.notes = body.notes;

    const entry = await db.libraryEntry.upsert({
      where,
      create: {
        userId: user.id, providerId: body.provider, externalId: body.externalId,
        category: body.category!, titleSnapshot: body.title!, coverSnapshot: body.cover ?? null,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({
      entry: {
        id: entry.id, status: entry.status, progress: entry.progress,
        score: entry.score, favorite: entry.favorite, notes: entry.notes,
        updatedAt: entry.updatedAt,
      },
    });
  });
}
