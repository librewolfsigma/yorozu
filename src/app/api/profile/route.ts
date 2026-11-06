import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, ApiError } from "@/lib/api-utils";

// Aggregated profile data: library, history, reports — all user-owned rows
// keyed by external refs (no media joins; the catalog lives upstream).
export async function GET(_req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");

    const [entries, history, reports] = await Promise.all([
      db.libraryEntry.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
      db.historyEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
      db.report.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.status] = (counts[e.status] ?? 0) + 1;

    return NextResponse.json({
      library: {
        entries: entries.map((e) => ({
          status: e.status, score: e.score, favorite: e.favorite,
          work: {
            provider: e.providerId,
            externalId: e.externalId,
            ref: `${e.providerId}:${e.externalId}`,
            category: e.category,
            title: e.titleSnapshot,
            coverUrl: e.coverSnapshot,
          },
        })),
        counts,
      },
      history: {
        entries: history.map((h) => ({
          action: h.action, category: h.category, createdAt: h.createdAt,
          titleSnapshot: h.titleSnapshot,
          ref: h.providerId && h.externalId ? `${h.providerId}:${h.externalId}` : null,
        })),
      },
      reports: reports.map((r) => ({
        id: r.id, targetType: r.targetType, reason: r.reason, status: r.status, createdAt: r.createdAt,
      })),
    });
  });
}
