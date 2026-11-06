import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/api-utils";
import { serializeMedia, serializeCatalogItem } from "@/lib/serialize";
import { getCurrentUser } from "@/lib/auth";

// Global search: unified database results (grouped by category) + provider results.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!q) return NextResponse.json({ q, groups: {}, providerResults: [], total: 0 });
    const key = q.toLowerCase();

    const [rows, catalogRows] = await Promise.all([
      db.media.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { altTitles: { contains: q } },
            { description: { contains: q } },
            { studio: { contains: q } },
            { creator: { contains: q } },
            { genres: { contains: key } },
            { tags: { contains: key } },
          ],
        },
        orderBy: { popularity: "desc" },
        take: 60,
      }),
      db.catalogItem.findMany({
        where: {
          imported: false,
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { genres: { contains: key } },
            { tags: { contains: key } },
          ],
        },
        orderBy: { popularity: "desc" },
        take: 12,
        include: { provider: { select: { id: true, name: true, installed: true, status: true } } },
      }),
    ]);

    const groups: Record<string, MediaDTO[]> = {};
    for (const m of rows) {
      (groups[m.category] ??= []).push(serializeMedia(m));
    }

    const user = await getCurrentUser();
    void user;

    return NextResponse.json({
      q,
      groups,
      providerResults: catalogRows.map((c) => ({
        ...serializeCatalogItem(c),
        provider: { id: c.provider.id, name: c.provider.name, installed: c.provider.installed, status: c.provider.status },
      })),
      total: rows.length,
    });
  });
}

type MediaDTO = ReturnType<typeof serializeMedia>;
