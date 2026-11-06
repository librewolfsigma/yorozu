import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

// Reviews — user notes about an EXTERNAL work (keyed by provider+externalId).
export async function GET(req: NextRequest) {
  return handle(async () => {
    const provider = req.nextUrl.searchParams.get("provider");
    const externalId = req.nextUrl.searchParams.get("externalId");
    if (!provider || !externalId) throw new ApiError(400, "provider and externalId are required");
    const user = await getCurrentUser();
    const rows = await db.review.findMany({
      where: { providerId: provider, externalId },
      include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      reviews: rows.map((r) => ({
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
    const body = await readJson<{
      provider?: string; externalId?: string; category?: string; titleSnapshot?: string;
      score?: number; title?: string; body?: string;
    }>(req);
    if (!body.provider || !body.externalId) throw new ApiError(400, "provider and externalId are required");
    if (!body.score || body.score < 1 || body.score > 10) throw new ApiError(400, "score must be 1–10");
    const review = await db.review.upsert({
      where: { userId_providerId_externalId: { userId: user.id, providerId: body.provider, externalId: body.externalId } },
      create: {
        userId: user.id, providerId: body.provider, externalId: body.externalId,
        category: body.category ?? "MISC", titleSnapshot: body.titleSnapshot ?? null,
        score: body.score, title: body.title ?? null, body: body.body ?? null,
      },
      update: { score: body.score, title: body.title ?? null, body: body.body ?? null },
    });
    return NextResponse.json({ review: { id: review.id, score: review.score } });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const provider = req.nextUrl.searchParams.get("provider");
    const externalId = req.nextUrl.searchParams.get("externalId");
    if (!provider || !externalId) throw new ApiError(400, "provider and externalId are required");
    await db.review.deleteMany({ where: { userId: user.id, providerId: provider, externalId } });
    return NextResponse.json({ ok: true });
  });
}
