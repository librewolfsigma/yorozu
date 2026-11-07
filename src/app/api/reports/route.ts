import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";

// Moderation reports. Stored for review; surfaced in the user's profile.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    const body = await readJson<{ targetType?: string; targetId?: string; reason?: string; details?: string }>(req);
    if (!body.targetType || !body.targetId || !body.reason) {
      throw new ApiError(400, "targetType, targetId and reason are required");
    }
    const row = await db.report.create({
      data: {
        userId: user?.id ?? null,
        targetType: body.targetType.slice(0, 40),
        targetId: body.targetId,
        reason: body.reason.slice(0, 80),
        details: body.details?.slice(0, 1000),
      },
    });
    return NextResponse.json({ id: row.id });
  });
}

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const rows = await db.report.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ reports: rows });
  });
}
