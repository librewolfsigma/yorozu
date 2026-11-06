import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const mediaId = req.nextUrl.searchParams.get("mediaId");
    if (!mediaId) throw new ApiError(400, "mediaId is required");
    const user = await getCurrentUser();
    const reviews = await db.review.findMany({
      where: { mediaId },
      include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: r.id, score: r.score, title: r.title, body: r.body, createdAt: r.createdAt,
        user: { username: r.user.username, displayName: r.user.displayName ?? r.user.username, avatarUrl: r.user.avatarUrl },
        isMine: user ? r.userId === user.id : false,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to review.");
    const body = await readJson<{ mediaId?: string; score?: number; title?: string; body?: string }>(req);
    if (!body.mediaId || !body.score || body.score < 1 || body.score > 10) {
      throw new ApiError(400, "mediaId and score (1–10) are required");
    }
    const media = await db.media.findUnique({ where: { id: body.mediaId } });
    if (!media) throw new ApiError(404, "Title not found");

    await db.review.upsert({
      where: { userId_mediaId: { userId: user.id, mediaId: body.mediaId } },
      create: { userId: user.id, mediaId: body.mediaId, score: Math.round(body.score), title: body.title?.slice(0, 80), body: body.body?.slice(0, 2000) },
      update: { score: Math.round(body.score), title: body.title?.slice(0, 80), body: body.body?.slice(0, 2000) },
    });

    // recompute aggregate
    const agg = await db.review.aggregate({ where: { mediaId: body.mediaId }, _avg: { score: true }, _count: { _all: true } });
    await db.media.update({
      where: { id: body.mediaId },
      data: { rating: Math.round((agg._avg.score ?? 0) * 10) / 10, ratingCount: agg._count._all },
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const mediaId = req.nextUrl.searchParams.get("mediaId");
    if (!mediaId) throw new ApiError(400, "mediaId is required");
    const review = await db.review.findUnique({ where: { userId_mediaId: { userId: user.id, mediaId } } });
    if (!review) throw new ApiError(404, "Review not found");
    await db.review.delete({ where: { id: review.id } });
    const agg = await db.review.aggregate({ where: { mediaId }, _avg: { score: true }, _count: { _all: true } });
    await db.media.update({
      where: { id: mediaId },
      data: { rating: Math.round((agg._avg.score ?? 0) * 10) / 10, ratingCount: agg._count._all },
    });
    return NextResponse.json({ ok: true });
  });
}
