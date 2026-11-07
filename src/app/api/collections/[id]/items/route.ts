import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

// Items in a collection — keyed by the EXTERNAL ref.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to manage collections.");
    const collection = await db.collection.findUnique({ where: { id } });
    if (!collection || collection.userId !== user.id) throw new ApiError(404, "Collection not found");
    const body = await readJson<{ provider?: string; externalId?: string; category?: string; title?: string; cover?: string }>(req);
    if (!body.provider || !body.externalId || !body.title) {
      throw new ApiError(400, "provider, externalId and title are required");
    }
    await db.collectionItem.upsert({
      where: { collectionId_providerId_externalId: { collectionId: id, providerId: body.provider, externalId: body.externalId } },
      create: {
        collectionId: id, providerId: body.provider, externalId: body.externalId,
        category: body.category ?? "MISC", titleSnapshot: body.title, coverSnapshot: body.cover ?? null,
      },
      update: { titleSnapshot: body.title, coverSnapshot: body.cover ?? null },
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to manage collections.");
    const collection = await db.collection.findUnique({ where: { id } });
    if (!collection || collection.userId !== user.id) throw new ApiError(404, "Collection not found");
    const provider = req.nextUrl.searchParams.get("provider");
    const externalId = req.nextUrl.searchParams.get("externalId");
    if (!provider || !externalId) throw new ApiError(400, "provider and externalId are required");
    await db.collectionItem.deleteMany({ where: { collectionId: id, providerId: provider, externalId } });
    return NextResponse.json({ ok: true });
  });
}
