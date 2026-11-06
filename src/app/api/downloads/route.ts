import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import { serializeMedia } from "@/lib/serialize";

// Download manager with an honest, time-based simulation for demo content.
const SPEED_BPS = 3 * 1024 * 1024; // 3 MB/s simulated

function tick(rows: {
  id: string; status: string; progress: number; sizeBytes: number;
  startedAt: Date | null; speedBps: number;
}[]) {
  const now = Date.now();
  return rows.map((r) => {
    if (r.status !== "RUNNING" || !r.startedAt) return { ...r, progress: r.progress, speedBps: r.speedBps };
    const elapsed = (now - r.startedAt.getTime()) / 1000;
    const progressed = r.progress + (elapsed * SPEED_BPS) / r.sizeBytes;
    return {
      ...r,
      progress: Math.min(1, progressed),
      speedBps: progressed >= 1 ? 0 : SPEED_BPS,
      done: progressed >= 1,
    };
  });
}

async function syncDownloads(userId: string) {
  const running = await db.download.findMany({
    where: { userId, status: "RUNNING" },
  });
  const now = Date.now();
  for (const r of running) {
    if (!r.startedAt) continue;
    const elapsed = (now - r.startedAt.getTime()) / 1000;
    const progressed = r.progress + (elapsed * SPEED_BPS) / r.sizeBytes;
    if (progressed >= 1) {
      await db.download.update({
        where: { id: r.id },
        data: { progress: 1, status: "DONE", completedAt: new Date(), speedBps: 0 },
      });
      await db.notification.create({
        data: { userId, type: "SUCCESS", title: "Download complete", body: `${r.label} is available offline.`, link: "#/downloads" },
      });
    } else {
      await db.download.update({
        where: { id: r.id },
        data: { progress: progressed, speedBps: SPEED_BPS, startedAt: new Date() },
      });
    }
  }
}

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to view downloads.");
    await syncDownloads(user.id);
    const rows = await db.download.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { media: true },
    });
    return NextResponse.json({
      downloads: rows.map((r) => ({
        id: r.id, label: r.label, kind: r.kind, status: r.status,
        progress: r.progress, speedBps: r.speedBps, sizeBytes: r.sizeBytes,
        startedAt: r.startedAt, completedAt: r.completedAt, error: r.error,
        createdAt: r.createdAt,
        media: serializeMedia(r.media),
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to download.");
    const body = await readJson<{ mediaId?: string; itemId?: string; label?: string; kind?: string; sizeBytes?: number }>(req);
    if (!body.mediaId || !body.kind) throw new ApiError(400, "mediaId and kind are required");
    const media = await db.media.findUnique({ where: { id: body.mediaId } });
    if (!media) throw new ApiError(404, "Title not found");

    const row = await db.download.create({
      data: {
        userId: user.id, mediaId: body.mediaId, itemId: body.itemId ?? null,
        label: body.label?.slice(0, 120) ?? media.title,
        kind: body.kind,
        sizeBytes: body.sizeBytes ?? 220 * 1024 * 1024,
        status: "RUNNING", startedAt: new Date(), speedBps: SPEED_BPS,
      },
    });
    await db.historyEntry.create({
      data: {
        userId: user.id, mediaId: body.mediaId, action: "DOWNLOAD", category: media.category,
        titleSnapshot: media.title, coverSnapshot: media.coverUrl,
        detail: JSON.stringify({ kind: body.kind, label: body.label }),
      },
    });
    return NextResponse.json({ download: { id: row.id } });
  });
}
