import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, ApiError } from "@/lib/api-utils";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to manage collections.");
    const collection = await db.collection.findUnique({ where: { id } });
    if (!collection || collection.userId !== user.id) throw new ApiError(404, "Collection not found");
    await db.collection.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
