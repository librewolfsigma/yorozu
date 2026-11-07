import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

// History — snapshot-only audit of the user's own actions. No media FK.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to view history.");
    const limit = Math.min(200, Math.max(10, parseInt(req.nextUrl.searchParams.get("limit") ?? "60", 10)));
    const rows = await db.historyEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({
      entries: rows.map((r) => ({
        id: r.id, action: r.action, category: r.category,
        provider: r.providerId, externalId: r.externalId,
        ref: r.providerId && r.externalId ? `${r.providerId}:${r.externalId}` : null,
        detail: r.detail ? JSON.parse(r.detail) : null,
        titleSnapshot: r.titleSnapshot, coverSnapshot: r.coverSnapshot,
        createdAt: r.createdAt,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const body = await readJson<{
      action?: string; provider?: string; externalId?: string; category?: string;
      detail?: Record<string, unknown>; titleSnapshot?: string; coverSnapshot?: string;
    }>(req);
    if (!body.action) throw new ApiError(400, "action is required");
    await db.historyEntry.create({
      data: {
        userId: user.id,
        providerId: body.provider ?? null,
        externalId: body.externalId ?? null,
        action: body.action,
        category: body.category ?? "MISC",
        detail: body.detail ? JSON.stringify(body.detail) : null,
        titleSnapshot: body.titleSnapshot ?? null,
        coverSnapshot: body.coverSnapshot ?? null,
      },
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
