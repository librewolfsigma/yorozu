import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

async function ownedCollection(userId: string, id: string) {
  const row = await db.collection.findUnique({ where: { id } });
  if (!row || row.userId !== userId) throw new ApiError(404, "Collection not found");
  return row;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const { id } = await ctx.params;
    await ownedCollection(user.id, id);
    const body = await readJson<{ name?: string; description?: string; isPublic?: boolean }>(req);
    const row = await db.collection.update({
      where: { id },
      data: {
        name: body.name?.slice(0, 60),
        description: body.description?.slice(0, 300),
        isPublic: body.isPublic,
      },
    });
    return NextResponse.json({ collection: { id: row.id, name: row.name } });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const { id } = await ctx.params;
    await ownedCollection(user.id, id);
    await db.collection.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
