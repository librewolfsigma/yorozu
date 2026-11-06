import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import { serializeMedia } from "@/lib/serialize";

// Personal library: list / upsert / patch / remove.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to view your library.");
    const status = req.nextUrl.searchParams.get("status");
    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;
    const entries = await db.libraryEntry.findMany({
      where,
      include: { media: true },
      orderBy: { updatedAt: "desc" },
    });
    const all = await db.libraryEntry.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { _all: true },
    });
    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id, status: e.status, progress: e.progress, score: e.score,
        favorite: e.favorite, notes: e.notes, updatedAt: e.updatedAt,
        media: serializeMedia(e.media),
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
      mediaId?: string; status?: string; score?: number | null;
      favorite?: boolean; notes?: string | null; remove?: boolean;
    }>(req);
    if (!body.mediaId) throw new ApiError(400, "mediaId is required");
    const media = await db.media.findUnique({ where: { id: body.mediaId } });
    if (!media) throw new ApiError(404, "Title not found");

    if (body.remove) {
      await db.libraryEntry.deleteMany({ where: { userId: user.id, mediaId: body.mediaId } });
      return NextResponse.json({ removed: true });
    }

    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.score !== undefined) data.score = body.score;
    if (body.favorite !== undefined) data.favorite = body.favorite;
    if (body.notes !== undefined) data.notes = body.notes;

    const entry = await db.libraryEntry.upsert({
      where: { userId_mediaId: { userId: user.id, mediaId: body.mediaId } },
      create: { userId: user.id, mediaId: body.mediaId, ...data },
      update: data,
      include: { media: true },
    });

    await db.historyEntry.create({
      data: {
        userId: user.id, mediaId: body.mediaId, action: "VIEW", category: media.category,
        titleSnapshot: media.title, coverSnapshot: media.coverUrl,
        detail: JSON.stringify({ libraryChange: data }),
      },
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
