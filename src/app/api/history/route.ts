import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to view history.");
    const limit = Math.min(200, Math.max(10, parseInt(req.nextUrl.searchParams.get("limit") ?? "60", 10)));
    const rows = await db.historyEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { media: { select: { slug: true } } },
    });
    return NextResponse.json({
      entries: rows.map((r) => ({
        id: r.id, action: r.action, category: r.category,
        detail: r.detail ? JSON.parse(r.detail) : null,
        titleSnapshot: r.titleSnapshot, coverSnapshot: r.coverSnapshot,
        createdAt: r.createdAt,
        mediaSlug: r.media?.slug ?? null,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const body = await readJson<{ action?: string; mediaId?: string; category?: string; detail?: Record<string, unknown>; titleSnapshot?: string; coverSnapshot?: string }>(req);
    if (!body.action) throw new ApiError(400, "action is required");
    let mediaId = body.mediaId ?? null;
    let { titleSnapshot, coverSnapshot, category } = body;
    if (mediaId) {
      const media = await db.media.findUnique({ where: { id: mediaId } });
      if (media) {
        titleSnapshot = titleSnapshot ?? media.title;
        coverSnapshot = coverSnapshot ?? media.coverUrl;
        category = category ?? media.category;
      }
    }
    await db.historyEntry.create({
      data: { userId: user.id, mediaId, action: body.action, category: category ?? "MISC", detail: body.detail ? JSON.stringify(body.detail) : null, titleSnapshot, coverSnapshot },
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    await db.historyEntry.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ ok: true });
  });
}
