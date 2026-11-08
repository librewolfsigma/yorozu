import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

// Collections — user-owned groups of EXTERNAL refs.
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to view collections.");
    const rows = await db.collection.findMany({
      where: { userId: user.id },
      include: { items: { orderBy: { addedAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      collections: rows.map((c) => ({
        id: c.id, name: c.name, description: c.description, createdAt: c.createdAt,
        cover: c.items[0]?.coverSnapshot ?? null,
        items: c.items.map((i) => ({
          provider: i.providerId,
          externalId: i.externalId,
          ref: `${i.providerId}:${i.externalId}`,
          category: i.category,
          title: i.titleSnapshot,
          coverUrl: i.coverSnapshot,
          addedAt: i.addedAt,
        })),
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to manage collections.");
    const body = await readJson<{ name?: string; description?: string }>(req);
    if (!body.name?.trim()) throw new ApiError(400, "name is required");
    const collection = await db.collection.create({
      data: { userId: user.id, name: body.name.trim().slice(0, 80), description: body.description?.slice(0, 300) ?? null },
    });
    return NextResponse.json({ collection: { id: collection.id, name: collection.name } });
  });
}
