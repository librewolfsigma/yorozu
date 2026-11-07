import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, ApiError } from "@/lib/api-utils";
import { getWork } from "@/lib/providers/engine";
import { workRef } from "@/lib/serialize";
import { proxyUrl } from "@/lib/imgproxy";

// Live work detail — the client-first replacement for /api/media/[slug] +
// /api/episodes + /api/chapters + /api/gallery. Metadata, units (episodes /
// chapters / images), the provider rail and the user's own state (library,
// collections, reviews) are assembled per request. No content is stored.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams;
    const provider = sp.get("p");
    const externalId = sp.get("id");
    if (!provider || !externalId) throw new ApiError(400, "p (provider) and id (externalId) are required");

    // fresh=1 → skip the short units cache and force a NEW upstream resolve.
    // The player's mid-stream recovery uses this after a token dies mid-video:
    // the cached token may be the very one that just expired, so a plain
    // refetch could hand back the same dead URL.
    const freshUnits = sp.get("fresh") === "1";
    const { work, units, popular, detailError, provider: prov } = await getWork(provider, externalId, { freshUnits });

    const user = await getCurrentUser();
    const ref = workRef(provider, externalId);

    let library: { status: string; progress: number; score: number | null; favorite: boolean; notes: string | null } | null = null;
    let myCollections: { id: string; name: string; hasItem: boolean }[] = [];
    let reviews: {
      id: string; score: number; title: string | null; body: string | null; createdAt: Date;
      user: { username: string; displayName: string; avatarUrl: string | null }; isMine: boolean;
    }[] = [];

    if (user) {
      const [entry, collections, reviewRows] = await Promise.all([
        db.libraryEntry.findUnique({
          where: { userId_providerId_externalId: { userId: user.id, providerId: provider, externalId } },
        }),
        db.collection.findMany({
          where: { userId: user.id },
          include: { items: { where: { providerId: provider, externalId }, select: { id: true } } },
        }),
        db.review.findMany({
          where: { providerId: provider, externalId },
          include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      library = entry ? { status: entry.status, progress: entry.progress, score: entry.score, favorite: entry.favorite, notes: entry.notes } : null;
      myCollections = collections.map((c) => ({ id: c.id, name: c.name, hasItem: c.items.length > 0 }));
      reviews = reviewRows.map((r) => ({
        id: r.id, score: r.score, title: r.title, body: r.body, createdAt: r.createdAt,
        user: { username: r.user.username, displayName: r.user.displayName ?? r.user.username, avatarUrl: r.user.avatarUrl },
        isMine: r.userId === user.id,
      }));
    } else {
      reviews = (await db.review.findMany({
        where: { providerId: provider, externalId },
        include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      })).map((r) => ({
        id: r.id, score: r.score, title: r.title, body: r.body, createdAt: r.createdAt,
        user: { username: r.user.username, displayName: r.user.displayName ?? r.user.username, avatarUrl: r.user.avatarUrl },
        isMine: false,
      }));
    }

    // units → contract DTOs (keys are provider-local and stable for progress).
    // Chapters come in two honest shapes:
    //   - pageKind "page-url"  → resolveUrl token; the reader resolves pages
    //     live via /api/pages (MangaDex at-home, Manga18fx) — nothing cached.
    //   - otherwise            → inline displayable image URLs (E-Hentai
    //     viewer pages, resolved on the fly by the /api/img proxy).
    const episodes = (units?.episodes ?? []).map((e) => ({
      key: `ep:${e.number}`,
      number: e.number,
      title: e.title ?? null,
      thumbnailUrl: proxyUrl(e.thumbnailUrl ?? null),
      durationSec: e.durationSec ?? null,
      streamUrl: e.streamUrl ? `/api/img?u=${encodeURIComponent(e.streamUrl)}&stream=1` : null,
      streamType: e.streamUrl ? (e.streamType ?? "mp4") : null,
      summary: e.summary ?? null,
    }));

    const chapters = (units?.chapters ?? []).map((c) => {
      const lazy = c.pageKind === "page-url";
      return {
        key: `ch:${c.number}`,
        number: c.number,
        title: c.title ?? null,
        pageCount: lazy ? null : c.pages.length,
        pages: lazy ? null : c.pages.map((u) => proxyUrl(u) ?? u),
        resolveUrl: lazy ? c.pages[0] : null,
      };
    });

    const images = (units?.images ?? []).map((img) => ({
      url: proxyUrl(img.url) ?? img.url,
      thumbUrl: proxyUrl(img.thumbUrl ?? null),
      width: img.width ?? 800,
      height: img.height ?? 1200,
      tags: (img.tags ?? []).slice(0, 30),
    }));

    return NextResponse.json({
      work,
      units: { episodes, chapters, images },
      detailError: detailError ?? null,
      provider: prov,
      popular,
      reviews,
      library,
      myCollections,
      ref,
    });
  });
}
