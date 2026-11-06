import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import { serializeMedia } from "@/lib/serialize";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to view collections.");
    const rows = await db.collection.findMany({
      where: { userId: user.id },
      include: { items: { include: { media: true }, orderBy: { addedAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      collections: rows.map((c) => ({
        id: c.id, name: c.name, description: c.description, isPublic: c.isPublic,
        createdAt: c.createdAt,
        items: c.items.map((i) => ({ id: i.id, addedAt: i.addedAt, media: serializeMedia(i.media) })),
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const body = await readJson<{ name?: string; description?: string }>(req);
    const name = (body.name ?? "").trim();
    if (!name) throw new ApiError(400, "Collection name is required.");
    const row = await db.collection.create({
      data: { userId: user.id, name: name.slice(0, 60), description: body.description?.slice(0, 300) },
    });
    return NextResponse.json({ collection: { id: row.id, name: row.name } });
  });
}
