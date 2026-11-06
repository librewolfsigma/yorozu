import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

// pause | resume | cancel | retry
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const { id } = await ctx.params;
    const row = await db.download.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) throw new ApiError(404, "Download not found");
    const body = await readJson<{ action?: string }>(req);

    switch (body.action) {
      case "pause":
        if (row.status === "RUNNING") {
          await db.download.update({ where: { id }, data: { status: "PAUSED", speedBps: 0 } });
        }
        break;
      case "resume":
        if (row.status === "PAUSED" || row.status === "QUEUED") {
          await db.download.update({ where: { id }, data: { status: "RUNNING", startedAt: new Date(), speedBps: 3 * 1024 * 1024 } });
        }
        break;
      case "cancel":
        await db.download.update({ where: { id }, data: { status: "CANCELLED", speedBps: 0 } });
        break;
      case "retry":
        await db.download.update({
          where: { id },
          data: { status: "RUNNING", progress: 0, startedAt: new Date(), error: null, speedBps: 3 * 1024 * 1024, completedAt: null },
        });
        break;
      default:
        throw new ApiError(400, "Unknown action");
    }
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const { id } = await ctx.params;
    const row = await db.download.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) throw new ApiError(404, "Download not found");
    await db.download.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
