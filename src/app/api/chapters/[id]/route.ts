import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, ApiError } from "@/lib/api-utils";
import { getLiveAdapter } from "@/lib/providers/live";
import { proxyUrl } from "@/lib/imgproxy";

// Chapter pages for the reader.
// Chapters imported from live providers may store a sourceUrl (upstream page)
// and resolve their real image URLs lazily on first open. Resolution results
// are cached into ChapterPage rows so subsequent opens are instant.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    let chapter = await db.chapter.findUnique({
      where: { id },
      include: { pages: { orderBy: { idx: "asc" } }, media: { select: { id: true, title: true } } },
    });
    if (!chapter) throw new ApiError(404, "Chapter not found");

    // Lazy resolution path
    if (chapter.pages.length === 0 && chapter.sourceProvider && chapter.sourceUrl) {
      const adapter = getLiveAdapter(chapter.sourceProvider);
      if (adapter?.resolveChapter) {
        const images = await adapter.resolveChapter(chapter.sourceUrl).catch(() => [] as string[]);
        if (images.length) {
          await db.chapterPage.deleteMany({ where: { chapterId: chapter.id } });
          for (let i = 0; i < images.length; i++) {
            await db.chapterPage.create({
              data: {
                chapterId: chapter.id, idx: i,
                imageUrl: proxyUrl(images[i]) ?? images[i],
              },
            });
          }
          chapter = await db.chapter.update({
            where: { id: chapter.id },
            data: { pageCount: images.length },
            include: { pages: { orderBy: { idx: "asc" } }, media: { select: { id: true, title: true } } },
          });
        }
      }
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
