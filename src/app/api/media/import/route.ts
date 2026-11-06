import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import { importCatalogItem } from "@/lib/providers/engine";
import { db } from "@/lib/db";

// Import a provider catalog item into the unified database (dedup/merge aware).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to import titles.");
    const body = await readJson<{ catalogItemId?: string }>(req);
    if (!body.catalogItemId) throw new ApiError(400, "catalogItemId is required");
    const result = await importCatalogItem(body.catalogItemId);
    const item = await db.catalogItem.findUnique({ where: { id: body.catalogItemId } });
    await db.historyEntry.create({
      data: {
        userId: user.id, action: "IMPORT", category: item?.category ?? "MISC",
        titleSnapshot: item?.title ?? null, coverSnapshot: item?.coverUrl ?? null,
        detail: JSON.stringify({ providerId: item?.providerId, merged: result.merged }),
      },
    });
    await db.notification.create({
      data: {
        userId: user.id, type: "SUCCESS",
        title: result.merged ? "Provider merged into existing title" : "Title imported to your database",
        body: result.merged
          ? "Duplicate detected — the provider was linked to the unified entry."
          : `${item?.title ?? "Item"} is now available across the platform.`,
        link: `#/media/${result.slug}`,
      },
    });
    return NextResponse.json(result);
  });
}
