import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

// Progress sync from reader/player + library auto-advance.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to track progress.");
    const body = await readJson<{
      mediaId?: string; itemId?: string; kind?: string;
      positionSec?: number; pageIndex?: number; completed?: boolean;
    }>(req);
    const { mediaId, itemId, kind } = body;
    if (!mediaId || !itemId || !kind) throw new ApiError(400, "mediaId, itemId and kind are required");
    const media = await db.media.findUnique({ where: { id: mediaId } });
    if (!media) throw new ApiError(404, "Title not found");

    const completed = body.completed ?? false;
    const progress = await db.progress.upsert({
      where: { userId_itemId: { userId: user.id, itemId } },
      create: {
        userId: user.id, mediaId, itemId, kind,
        positionSec: body.positionSec ?? null,
        pageIndex: body.pageIndex ?? null,
        completed,
      },
      update: {
        positionSec: body.positionSec ?? undefined,
        pageIndex: body.pageIndex ?? undefined,
        completed: completed || undefined,
      },
    });

    // auto-advance library entry
    const entry = await db.libraryEntry.findUnique({
      where: { userId_mediaId: { userId: user.id, mediaId } },
    });
    let unitNumber: number | null = null;
    if (kind === "CHAPTER") {
      const ch = await db.chapter.findUnique({ where: { id: itemId } });
      unitNumber = ch?.number ?? null;
    } else if (kind === "EPISODE") {
      const ep = await db.episode.findUnique({ where: { id: itemId } });
      unitNumber = ep?.number ?? null;
    }

    if (!entry) {
      await db.libraryEntry.create({
        data: {
          userId: user.id, mediaId,
          status: completed && unitNumber !== null ? "IN_PROGRESS" : "IN_PROGRESS",
          progress: unitNumber ?? 0,
        },
      });
    } else if (unitNumber !== null && completed && unitNumber > entry.progress) {
      const totalUnits = kind === "CHAPTER"
        ? await db.chapter.count({ where: { mediaId } })
        : await db.episode.count({ where: { mediaId } });
      const lastUnit = kind === "CHAPTER"
        ? (await db.chapter.findFirst({ where: { mediaId }, orderBy: { number: "desc" } }))?.number ?? 0
        : (await db.episode.findFirst({ where: { mediaId }, orderBy: { number: "desc" } }))?.number ?? 0;
      await db.libraryEntry.update({
        where: { id: entry.id },
        data: {
          progress: unitNumber,
          status: unitNumber >= lastUnit && totalUnits > 0 ? "COMPLETED" : entry.status === "COMPLETED" ? "IN_PROGRESS" : entry.status === "PLANNING" ? "IN_PROGRESS" : entry.status,
        },
      });
    }

    await db.historyEntry.create({
      data: {
        userId: user.id, mediaId, category: media.category,
        action: kind === "EPISODE" ? "WATCH" : "READ",
        titleSnapshot: media.title, coverSnapshot: media.coverUrl,
        detail: JSON.stringify({ itemId, completed }),
      },
    });

    return NextResponse.json({ ok: true, progress: { itemId: progress.itemId, completed: progress.completed } });
  });
}
