import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, ApiError } from "@/lib/api-utils";
import { serializeMedia } from "@/lib/serialize";
import { getCurrentUser } from "@/lib/auth";

// Full media detail: units, characters, people, reviews, provider links, related.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const media = await db.media.findUnique({
      where: { slug },
      include: {
        episodes: { orderBy: { number: "asc" } },
        chapters: { orderBy: { number: "desc" } },
        gallery: { orderBy: { idx: "asc" } },
        characters: { include: { character: true } },
        people: { include: { person: true } },
        links: true,
        reviews: { include: { user: { select: { username: true, displayName: true, avatarUrl: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!media) throw new ApiError(404, "Title not found");

    // related: shared genres
    const genres = JSON.parse(media.genres) as string[];
    const candidates = await db.media.findMany({
      where: { category: media.category, id: { not: media.id }, OR: genres.map((g) => ({ genres: { contains: g } })) },
      orderBy: { popularity: "desc" },
      take: 12,
    });

    const user = await getCurrentUser();
    let libraryState: { status: string; progress: number; score: number | null; favorite: boolean; notes: string | null } | null = null;
    if (user) {
      const entry = await db.libraryEntry.findUnique({
        where: { userId_mediaId: { userId: user.id, mediaId: media.id } },
      });
      libraryState = entry ? { status: entry.status, progress: entry.progress, score: entry.score, favorite: entry.favorite, notes: entry.notes } : null;
    }

    const providers = await db.provider.findMany({
      where: { id: { in: media.links.map((l) => l.providerId) } },
      select: { id: true, name: true, status: true },
    });

    const collections = user
      ? await db.collection.findMany({
          where: { userId: user.id },
          include: { items: { where: { mediaId: media.id }, select: { id: true } } },
        })
      : [];

    return NextResponse.json({
      media: serializeMedia(media),
      episodes: media.episodes.map((e) => ({
        id: e.id, number: e.number, title: e.title, durationSec: e.durationSec,
        thumbnailUrl: e.thumbnailUrl, streamUrl: e.streamUrl, streamType: e.streamType,
        summary: e.summary, releasedAt: e.releasedAt,
      })),
      chapters: media.chapters.map((c) => ({
        id: c.id, number: c.number, title: c.title, volume: c.volume,
        pageCount: c.pageCount, releasedAt: c.releasedAt,
      })),
      gallery: media.gallery.map((g) => ({
        id: g.id, idx: g.idx, imageUrl: g.imageUrl, thumbUrl: g.thumbUrl,
        width: g.width, height: g.height, tags: JSON.parse(g.tags || "[]"), favCount: g.favCount,
      })),
      characters: media.characters.map((mc) => ({
        id: mc.character.id, name: mc.character.name, role: mc.role,
        description: mc.character.description, imageUrl: mc.character.imageUrl,
      })),
      people: media.people.map((mp) => ({
        id: mp.person.id, name: mp.person.name, kind: mp.person.kind,
        bio: mp.person.bio, role: mp.role,
      })),
      reviews: media.reviews.map((r) => ({
        id: r.id, score: r.score, title: r.title, body: r.body,
        createdAt: r.createdAt,
        user: { username: r.user.username, displayName: r.user.displayName ?? r.user.username, avatarUrl: r.user.avatarUrl },
        isMine: user ? r.userId === user.id : false,
      })),
      links: media.links.map((l) => ({
        providerId: l.providerId, externalId: l.externalId, externalUrl: l.externalUrl,
      })),
      providers,
      related: candidates.map(serializeMedia),
      library: libraryState,
      myCollections: collections.map((c) => ({ id: c.id, name: c.name, hasItem: c.items.length > 0 })),
    });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const media = await db.media.findUnique({ where: { slug } });
    if (!media) throw new ApiError(404, "Title not found");
    await db.media.delete({ where: { slug } });
    return NextResponse.json({ ok: true });
  });
}
