import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, ApiError } from "@/lib/api-utils";

// Per-image favorite toggle for illustration galleries.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to favorite images.");
    const { id } = await ctx.params;
    const image = await db.galleryImage.findUnique({ where: { id } });
    if (!image) throw new ApiError(404, "Image not found");
    const existing = await db.galleryFavorite.findUnique({
      where: { userId_imageId: { userId: user.id, imageId: id } },
    });
    if (existing) {
      await db.galleryFavorite.delete({ where: { id: existing.id } });
      await db.galleryImage.update({ where: { id }, data: { favCount: { decrement: 1 } } });
      return NextResponse.json({ favorited: false });
    }
    await db.galleryFavorite.create({ data: { userId: user.id, imageId: id } });
    await db.galleryImage.update({ where: { id }, data: { favCount: { increment: 1 } } });
    return NextResponse.json({ favorited: true });
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const { id } = await ctx.params;
    const existing = await db.galleryFavorite.findUnique({
      where: { userId_imageId: { userId: user.id, imageId: id } },
    });
    return NextResponse.json({ favorited: !!existing });
  });
}
