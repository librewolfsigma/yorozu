import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, ApiError } from "@/lib/api-utils";

// Episode + stream metadata for the player. Streams only exist when the
// provider authorizes them; otherwise the UI shows an honest availability note.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const episode = await db.episode.findUnique({
      where: { id },
      include: {
        media: { select: { id: true, slug: true, title: true, category: true, accent: true } },
      },
    });
    if (!episode) throw new ApiError(404, "Episode not found");
    const siblings = await db.episode.findMany({
      where: { mediaId: episode.mediaId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, title: true },
    });
    return NextResponse.json({
      id: episode.id,
      media: episode.media,
      number: episode.number,
      title: episode.title,
      durationSec: episode.durationSec,
      streamUrl: episode.streamUrl,
      streamType: episode.streamType,
      summary: episode.summary,
      siblings,
    });
  });
}
