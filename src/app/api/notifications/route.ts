import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to view notifications.");
    const [rows, unread] = await Promise.all([
      db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40 }),
      db.notification.count({ where: { userId: user.id, read: false } }),
    ]);
    return NextResponse.json({ notifications: rows, unread });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const body = await readJson<{ id?: string; all?: boolean }>(req);
    if (body.all) {
      await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    } else if (body.id) {
      await db.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { read: true } });
    }
    return NextResponse.json({ ok: true });
  });
}
