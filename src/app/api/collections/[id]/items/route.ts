import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const { id } = await ctx.params;
    const col = await db.collection.findUnique({ where: { id } });
    if (!col || col.userId !== user.id) throw new ApiError(404, "Collection not found");
    const body = await readJson<{ mediaId?: string }>(req);
    if (!body.mediaId) throw new ApiError(400, "mediaId is required");
    const media = await db.media.findUnique({ where: { id: body.mediaId } });
    if (!media) throw new ApiError(404, "Title not found");
    await db.collectionItem.upsert({
      where: { collectionId_mediaId: { collectionId: id, mediaId: body.mediaId } },
      create: { collectionId: id, mediaId: body.mediaId },
      update: {},
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const { id } = await ctx.params;
    const col = await db.collection.findUnique({ where: { id } });
    if (!col || col.userId !== user.id) throw new ApiError(404, "Collection not found");
    const mediaId = req.nextUrl.searchParams.get("mediaId");
    if (!mediaId) throw new ApiError(400, "mediaId is required");
    await db.collectionItem.deleteMany({ where: { collectionId: id, mediaId } });
    return NextResponse.json({ ok: true });
  });
}
