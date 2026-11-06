import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import { serializeMedia } from "@/lib/serialize";
import { EH_PAGE_RE, ehResolveImage } from "@/lib/providers/live/manga";

// Download manager — REAL downloads only.
// A download row holds a real, resolvable file URL (a provider-hosted image,
// gallery page or clip served through /api/img). The browser fetches
// /api/downloads/[id]/file, which streams the actual bytes; the row is marked
// DONE with the real size once the transfer finishes. There is no simulation.

/** Unwrap /api/img proxy URLs back to the upstream URL. */
function unwrap(u: string): string {
  if (u.startsWith("/api/img?u=")) {
    try {
      return new URL(u, "http://localhost").searchParams.get("u") ?? u;
    } catch { return u; }
  }
  return u;
}

/** Resolve a real, downloadable URL for a media item. */
async function resolveDownloadUrl(mediaId: string, kind: string, itemId?: string | null): Promise<{ url: string; label: string } | null> {
  if (kind === "EPISODE") {
    const ep = itemId
      ? await db.episode.findFirst({ where: { id: itemId, mediaId } })
      : await db.episode.findFirst({ where: { mediaId }, orderBy: { number: "asc" } });
    if (ep?.streamUrl) return { url: ep.streamUrl, label: ep.title ? `EP${ep.number} ${ep.title}` : `Episode ${ep.number}` };
    return null;
  }
  if (kind === "CHAPTER") {
    const ch = itemId
      ? await db.chapter.findFirst({ where: { id: itemId, mediaId }, include: { pages: { orderBy: { idx: "asc" } } } })
      : await db.chapter.findFirst({ where: { mediaId }, include: { pages: { orderBy: { idx: "asc" } } } });
    if (ch?.pages.length) {
      const raw = unwrap(ch.pages[0].imageUrl);
      // E-Hentai viewer pages resolve to the real image on demand
      if (EH_PAGE_RE.test(raw)) {
        const img = await ehResolveImage(raw).catch(() => null);
        if (img) return { url: `/api/img?u=${encodeURIComponent(img)}`, label: ch.title ? `Ch.${ch.number} ${ch.title}` : `Chapter ${ch.number}` };
        return null;
      }
      return { url: ch.pages[0].imageUrl, label: ch.title ? `Ch.${ch.number} ${ch.title}` : `Chapter ${ch.number}` };
    }
    return null;
  }
  // GALLERY / default: first gallery image
  const img = await db.galleryImage.findFirst({ where: { mediaId }, orderBy: { idx: "asc" } });
  if (img?.imageUrl) return { url: img.imageUrl, label: "Gallery image" };
  return null;
}

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to view downloads.");
    const rows = await db.download.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { media: true },
    });
    return NextResponse.json({
      downloads: rows.map((r) => ({
        id: r.id, label: r.label, kind: r.kind, status: r.status,
        progress: r.status === "DONE" ? 1 : 0, speedBps: 0, sizeBytes: r.sizeBytes,
        startedAt: r.startedAt, completedAt: r.completedAt, error: r.error,
        hasFile: !!r.path,
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
    const body = await readJson<{ mediaId?: string; itemId?: string; label?: string; kind?: string }>(req);
    if (!body.mediaId || !body.kind) throw new ApiError(400, "mediaId and kind are required");
    const media = await db.media.findUnique({ where: { id: body.mediaId } });
    if (!media) throw new ApiError(404, "Title not found");

    const resolved = await resolveDownloadUrl(body.mediaId, body.kind, body.itemId ?? null);
    if (!resolved) {
      throw new ApiError(409, "No downloadable file is available for this item — content is served externally by the provider.");
    }

    const row = await db.download.create({
      data: {
        userId: user.id, mediaId: body.mediaId, itemId: body.itemId ?? null,
        label: (body.label || resolved.label).slice(0, 120),
        kind: body.kind,
        sizeBytes: 0, // real size recorded after the transfer
        status: "QUEUED",
        path: resolved.url,
      },
    });
    await db.historyEntry.create({
      data: {
        userId: user.id, mediaId: body.mediaId, action: "DOWNLOAD", category: media.category,
        titleSnapshot: media.title, coverSnapshot: media.coverUrl,
        detail: JSON.stringify({ kind: body.kind, label: body.label }),
      },
    });
    return NextResponse.json({ download: { id: row.id, fileUrl: `/api/downloads/${row.id}/file` } });
  });
}
