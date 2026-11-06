import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, ApiError } from "@/lib/api-utils";
import { getLiveAdapter } from "@/lib/providers/live";
import { proxyUrl } from "@/lib/imgproxy";

// Chapter pages for the reader.
// Chapters imported from live providers may store a sourceUrl (upstream page)
// and resolve their real image URLs lazily on first open. Resolution results
// are cached into ChapterPage rows so subsequent opens are instant.
//
// EXPIRING IMAGE HOSTS: MangaDex at-home base URLs rotate/expiry (~15 min).
// For providers listed in EXPIRING_PAGE_PROVIDERS, cached pages older than
// PAGE_TTL_MS are transparently re-resolved on open (images never 404 mid-read).
const EXPIRING_PAGE_PROVIDERS = new Set(["mangadex"]);
const PAGE_TTL_MS = 10 * 60 * 1000;

async function resolveIntoRows(chapterId: string, sourceProvider: string, sourceUrl: string, pagesResolvedAt: Date | null) {
  const adapter = getLiveAdapter(sourceProvider);
  if (!adapter?.resolveChapter) return null;
  const images = await adapter.resolveChapter(sourceUrl).catch(() => [] as string[]);
  if (!images.length) return null;
  await db.chapterPage.deleteMany({ where: { chapterId } });
  for (let i = 0; i < images.length; i++) {
    await db.chapterPage.create({
      data: { chapterId, idx: i, imageUrl: proxyUrl(images[i]) ?? images[i] },
    });
  }
  return db.chapter.update({
    where: { id: chapterId },
    data: { pageCount: images.length, pagesResolvedAt: new Date() },
    include: { pages: { orderBy: { idx: "asc" } }, media: { select: { id: true, title: true } } },
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    let chapter = await db.chapter.findUnique({
      where: { id },
      include: { pages: { orderBy: { idx: "asc" } }, media: { select: { id: true, title: true } } },
    });
    if (!chapter) throw new ApiError(404, "Chapter not found");

    // First open: no pages yet.
    if (chapter.pages.length === 0 && chapter.sourceProvider && chapter.sourceUrl) {
      const updated = await resolveIntoRows(chapter.id, chapter.sourceProvider, chapter.sourceUrl, null);
      if (updated) chapter = updated;
    } else if (
      chapter.pages.length > 0 &&
      chapter.sourceProvider &&
      chapter.sourceUrl &&
      EXPIRING_PAGE_PROVIDERS.has(chapter.sourceProvider) &&
      chapter.pagesResolvedAt &&
      Date.now() - chapter.pagesResolvedAt.getTime() > PAGE_TTL_MS
    ) {
      // Cached pages are past the expiry window — re-resolve transparently.
      const updated = await resolveIntoRows(chapter.id, chapter.sourceProvider, chapter.sourceUrl, chapter.pagesResolvedAt).catch(() => null);
      // If re-resolution fails (upstream hiccup) keep serving cached rows.
      if (updated) chapter = updated;
    }

    return NextResponse.json({
      id: chapter.id,
      mediaId: chapter.mediaId,
      number: chapter.number,
      title: chapter.title,
      pageCount: chapter.pageCount,
      pages: chapter.pages.map((p) => ({ id: p.id, idx: p.idx, imageUrl: p.imageUrl, width: p.width, height: p.height })),
    });
  });
}
