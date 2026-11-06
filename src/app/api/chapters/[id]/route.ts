import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, ApiError } from "@/lib/api-utils";

// Chapter pages for the reader.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const chapter = await db.chapter.findUnique({
      where: { id },
      include: { pages: { orderBy: { idx: "asc" } }, media: { select: { id: true, title: true } } },
    });
    if (!chapter) throw new ApiError(404, "Chapter not found");
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
