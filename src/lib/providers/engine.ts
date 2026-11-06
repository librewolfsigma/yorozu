import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import { PROVIDER_REGISTRY } from "./registry";
import {
  accentFor, coverUrl, bannerUrl, galleryUrl, normalizeTitle, pageUrl,
  planUnits, slugify, thumbUrl,
} from "@/lib/content-factory";
import { serializeCatalogItem } from "@/lib/serialize";

export { serializeCatalogItem };

const FLAG_MEDIA = JSON.stringify([
  "Explicit adult content (18+)",
  "All depicted characters are fictional adults (18+)",
]);
const FLAG_AV = JSON.stringify([
  "All performers are verified adults (18+)",
  "Produced under documented consent policies",
  "Demo placeholder content — no real explicit media",
]);

// ─── list ───
export async function listProviders() {
  const rows = await db.provider.findMany({
    include: { _count: { select: { items: true } } },
  });
  const serialize = (r: (typeof rows)[number]) => ({
    id: r.id, name: r.name, category: r.category, description: r.description,
    version: r.version, author: r.author, homepage: r.homepage,
    capabilities: JSON.parse(r.capabilities), configSchema: JSON.parse(r.configSchema || "[]"),
    config: JSON.parse(r.config || "{}"),
    status: r.status, lastError: r.lastError, lastCheckedAt: r.lastCheckedAt,
    installedAt: r.installedAt, itemCount: r._count.items,
  });
  return {
    installed: rows.filter((r) => r.installed).map(serialize),
    repository: rows.filter((r) => !r.installed).map(serialize),
  };
}

// ─── install / uninstall / toggle / configure ───
export async function installProvider(id: string) {
  const def = PROVIDER_REGISTRY.find((p) => p.id === id);
  const existing = await db.provider.findUnique({ where: { id } });
  if (existing?.installed) {
    throw new ApiError(409, "Provider already installed");
  }
  if (existing) {
    // re-enable a previously uninstalled adapter (catalog items are preserved)
    await db.provider.update({
      where: { id },
      data: { installed: true, status: "ACTIVE", lastError: null },
    });
    return db.provider.findUnique({ where: { id } });
  }
  if (!def) throw new ApiError(404, `Unknown provider: ${id}`);
  return db.provider.create({
    data: {
      id: def.id, name: def.name, category: def.category,
      description: def.description, version: def.version, author: def.author,
      homepage: def.homepage,
      capabilities: JSON.stringify(def.capabilities),
      configSchema: JSON.stringify(def.configSchema),
      config: JSON.stringify({}),
      status: "ACTIVE", installed: true,
    },
  });
}

export async function uninstallProvider(id: string) {
  const row = await db.provider.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, "Provider not installed");
  // Keep unified Media, provider catalog items and links; park the adapter in
  // the repository so it can be reinstalled without data loss.
  await db.provider.update({
    where: { id },
    data: { installed: false, status: "DISABLED", lastError: null },
  });
}

export async function toggleProvider(id: string) {
  const row = await db.provider.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, "Provider not installed");
  if (!row.installed) throw new ApiError(409, "Provider is not installed");
  return db.provider.update({
    where: { id },
    data: { status: row.status === "DISABLED" ? "ACTIVE" : "DISABLED", lastError: null },
  });
}

export async function configureProvider(id: string, config: Record<string, unknown>) {
  const row = await db.provider.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, "Provider not installed");
  const schema = JSON.parse(row.configSchema || "[]") as { key: string; required?: boolean }[];
  for (const field of schema) {
    if (field.required && (config[field.key] === undefined || config[field.key] === "")) {
      throw new ApiError(400, `Missing required config: ${field.key}`);
    }
  }
  return db.provider.update({
    where: { id },
    data: { config: JSON.stringify(config), lastError: null },
  });
}

// ─── health check (simulated adapter network call) ───
export async function healthCheck(id: string) {
  const row = await db.provider.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, "Provider not installed");

  let status = "ACTIVE";
  let lastError: string | null = null;

  if (row.status === "DISABLED") {
    status = "DISABLED";
    lastError = "Provider is disabled.";
  } else {
    const schema = JSON.parse(row.configSchema || "[]") as { key: string; required?: boolean; label: string }[];
    const config = JSON.parse(row.config || "{}");
    const missing = schema.find((f) => f.required && !config[f.key]);
    if (missing) {
      status = "ERROR";
      lastError = `Configuration required: set "${missing.label}" before this provider can connect.`;
    } else if (row.id === "sakurascan" && Math.random() < 0.35) {
      // documented simulated network jitter to exercise retry/error paths
      status = "ERROR";
      lastError = "Simulated upstream timeout (demo network jitter). Use Retry.";
    }
  }

  const updated = await db.provider.update({
    where: { id },
    data: { status, lastError, lastCheckedAt: new Date() },
  });

  if (status === "ERROR") {
    const users = await db.user.findMany({ select: { id: true }, take: 50 });
    for (const u of users) {
      await db.notification.create({
        data: {
          userId: u.id, type: "PROVIDER", title: `${row.name} health check failed`,
          body: lastError ?? "Unknown error", link: "#/extensions",
        },
      });
    }
  }

  return {
    id: updated.id, status: updated.status,
    lastError: updated.lastError, lastCheckedAt: updated.lastCheckedAt,
  };
}

// ─── catalog search for one provider ───
export async function searchCatalog(providerId: string, opts: { q?: string; page?: number; pageSize?: number }) {
  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) throw new ApiError(404, "Provider not installed");
  if (provider.status === "DISABLED") throw new ApiError(409, "Provider is disabled");
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 24));
  const where: Record<string, unknown> = { providerId };
  if (opts.q) where.title = { contains: opts.q };
  const [items, total] = await Promise.all([
    db.catalogItem.findMany({
      where, orderBy: { popularity: "desc" },
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    db.catalogItem.count({ where }),
  ]);
  return {
    provider: { id: provider.id, name: provider.name, category: provider.category, status: provider.status },
    items: items.map(serializeCatalogItem),
    total, page, pageSize,
  };
}

// ─── import: provider catalog item → unified media (with dedup merge) ───
export async function importCatalogItem(catalogItemId: string) {
  const item = await db.catalogItem.findUnique({ where: { id: catalogItemId } });
  if (!item) throw new ApiError(404, "Catalog item not found");
  const provider = await db.provider.findUnique({ where: { id: item.providerId } });
  if (!provider || !provider.installed) throw new ApiError(409, "Install the provider first");
  if (provider.status === "DISABLED") throw new ApiError(409, "Enable the provider first");

  const key = item.titleKey || normalizeTitle(item.title);
  let media = await db.media.findFirst({ where: { titleKey: key, category: item.category } });

  if (!media) {
    const accent = accentFor(item.category, key);
    const genres = JSON.parse(item.genres) as string[];
    const tags = JSON.parse(item.tags) as string[];
    const extra = JSON.parse(item.extra || "{}");
    let slug = slugify(item.title);
    let n = 2;
    while (await db.media.findUnique({ where: { slug } })) slug = `${slugify(item.title)}-${n++}`;

    media = await db.media.create({
      data: {
        slug, title: item.title, titleKey: key,
        altTitles: item.altTitles,
        description: item.description,
        coverUrl: item.coverUrl ?? coverUrl(slug, item.title, accent[0], item.category),
        bannerUrl: item.bannerUrl ?? bannerUrl(slug, item.title, accent[0]),
        accent: accent[0], accent2: accent[1],
        category: item.category, format: item.format, status: item.status,
        year: item.year,
        rating: item.score ?? 7.0, ratingCount: 40,
        popularity: item.popularity,
        genres: item.genres, tags: item.tags,
        studio: item.studio, creator: item.creator,
        ageRating: item.ageRating,
        contentFlags: item.category === "AV" ? FLAG_AV : FLAG_MEDIA,
        externalLinks: JSON.stringify([
          ...(item.externalUrl ? [{ label: "Official resource", url: item.externalUrl }] : []),
          { label: `${provider.name} listing`, url: item.externalUrl ?? `https://example.org/${provider.id}/${slugify(item.title)}` },
        ]),
        extra: item.extra,
      },
    });

    // materialize content units (episodes/chapters/pages/gallery)
    const itemExtra = extra as { scenes?: number };
    const plan = planUnits(item.category, key, {
      episodes: item.episodesCount ?? undefined,
      chapters: item.chaptersCount ?? undefined,
      scenes: item.category === "AV" ? (itemExtra.scenes ?? item.episodesCount ?? 3) : undefined,
      images: item.galleryCount ?? undefined,
    });
    for (const ep of plan.episodes) {
      await db.episode.create({
        data: {
          mediaId: media.id, number: ep.number, title: ep.title,
          durationSec: ep.durationSec,
          thumbnailUrl: thumbUrl(`${key}-ep${ep.number}`, `EP ${ep.number}`, accent[0]),
          streamUrl: null, streamType: "none",
          summary: ep.summary,
          releasedAt: item.year ? new Date(item.year, (ep.number - 1) % 12, 7) : null,
        },
      });
    }
    for (const ch of plan.chapters) {
      const chapter = await db.chapter.create({
        data: {
          mediaId: media.id, number: ch.number, title: ch.title,
          pageCount: ch.pageCount,
          releasedAt: item.year ? new Date(item.year, Math.floor((ch.number - 1) / 4) % 12, ((ch.number * 3) % 27) + 1) : null,
        },
      });
      for (let i = 0; i < ch.pageCount; i++) {
        await db.chapterPage.create({
          data: {
            chapterId: chapter.id, idx: i,
            imageUrl: pageUrl(`${key}-c${ch.number}-p${i}`, `Ch. ${ch.number} · ${i + 1}/${ch.pageCount}`),
          },
        });
      }
    }
    for (let i = 0; i < plan.galleryImages; i++) {
      await db.galleryImage.create({
        data: {
          mediaId: media.id, idx: i,
          imageUrl: galleryUrl(`${key}-g${i}`, accent[0]),
          thumbUrl: galleryUrl(`${key}-g${i}`, accent[0], 480, 700),
          tags: item.tags,
        },
      });
    }
  }

  // provider link (dedup path: media already existed)
  const existingLink = await db.providerLink.findUnique({
    where: { providerId_externalId: { providerId: item.providerId, externalId: item.externalId } },
  });
  if (!existingLink) {
    await db.providerLink.create({
      data: {
        mediaId: media.id, providerId: item.providerId,
        externalId: item.externalId, externalUrl: item.externalUrl,
      },
    });
  }
  await db.catalogItem.update({ where: { id: item.id }, data: { imported: true } });

  return { slug: media.slug, merged: existingLink !== null };
}
