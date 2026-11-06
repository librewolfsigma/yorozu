// Provider engine — Mihon-inspired extension architecture backed by REAL
// external integrations. Every adapter in ./live/ talks to a verified public
// API or public web pages; nothing here simulates upstream behaviour.
//
// Health checks are real requests. Search hits the real provider. Import
// materializes real metadata and real content-unit URLs into the unified DB.

import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import { PROVIDER_REGISTRY } from "./registry";
import { getLiveAdapter } from "./live";
import type { LiveSearchItem, LiveUnits, SearchOpts } from "./live/types";
import { normalizeTitle, slugify } from "@/lib/content-factory";
import { proxyUrl } from "@/lib/imgproxy";
import { serializeCatalogItem } from "@/lib/serialize";
import { accentFor } from "@/lib/content-factory";

export { serializeCatalogItem };

const FLAG_MEDIA = JSON.stringify([
  "Explicit adult content (18+)",
  "All depicted characters are fictional adults (18+)",
]);
const FLAG_AV = JSON.stringify([
  "Explicit adult content (18+)",
  "All performers depicted are fictional/adult-animated characters or verified adults per the source site",
  "Content served by the integrated third-party provider",
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
    live: true,
    integration: getLiveAdapter(r.id)?.integration ?? null,
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

// ─── health check — REAL upstream request via the adapter ───
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
    const adapter = getLiveAdapter(id);
    if (missing) {
      status = "ERROR";
      lastError = `Configuration required: set "${missing.label}" before this provider can connect.`;
    } else if (!adapter) {
      status = "ERROR";
      lastError = "No live adapter implementation is registered for this provider.";
    } else {
      try {
        await adapter.ping();
      } catch (e) {
        status = "ERROR";
        lastError = e instanceof Error ? e.message : String(e);
      }
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

// ─── catalog helpers ───

export async function upsertLiveItems(providerId: string, items: LiveSearchItem[]) {
  type CatalogRow = Parameters<typeof serializeCatalogItem>[0];
  const rows: CatalogRow[] = [];
  for (const item of items.slice(0, 40)) {
    const data = {
      providerId,
      externalId: item.externalId,
      title: item.title.slice(0, 300),
      titleKey: normalizeTitle(item.title).slice(0, 300),
      altTitles: JSON.stringify((item.altTitles ?? []).slice(0, 10)),
      description: item.description ?? null,
      coverUrl: item.coverUrl ?? null,
      bannerUrl: item.bannerUrl ?? null,
      category: item.category,
      format: item.format ?? null,
      status: item.status ?? null,
      year: item.year ?? null,
      score: item.score ?? null,
      popularity: item.popularity ?? 0,
      genres: JSON.stringify(item.genres ?? []),
      tags: JSON.stringify((item.tags ?? []).slice(0, 40)),
      studio: item.studio ?? null,
      creator: item.creator ?? null,
      ageRating: "18+",
      contentFlags: item.category === "AV" ? FLAG_AV : FLAG_MEDIA,
      externalUrl: item.externalUrl ?? null,
      extra: JSON.stringify(item.extra ?? {}),
      episodesCount: item.episodesCount ?? null,
      chaptersCount: item.chaptersCount ?? null,
      galleryCount: item.galleryCount ?? null,
    };
    const row = await db.catalogItem.upsert({
      where: { providerId_externalId: { providerId, externalId: item.externalId } },
      create: data,
      update: {
        title: data.title, titleKey: data.titleKey, altTitles: data.altTitles,
        description: data.description, coverUrl: data.coverUrl, bannerUrl: data.bannerUrl,
        score: data.score, popularity: data.popularity, genres: data.genres,
        tags: data.tags, externalUrl: data.externalUrl, extra: data.extra,
      },
    });
    rows.push(row);
  }
  return rows;
}

function providerOpts(row: { config: string | null }): SearchOpts {
  return { config: JSON.parse(row.config || "{}") };
}

// ─── catalog search for one provider — LIVE upstream call ───
export async function searchCatalog(providerId: string, opts: { q?: string; page?: number; pageSize?: number }) {
  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) throw new ApiError(404, "Provider not installed");
  if (provider.status === "DISABLED") throw new ApiError(409, "Provider is disabled");
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 24));
  const adapter = getLiveAdapter(providerId);
  if (!adapter) throw new ApiError(500, `No live adapter for ${providerId}`);

  try {
    const items = await adapter.search(opts.q ?? "", { page, ...providerOpts(provider) });
    const rows = await upsertLiveItems(providerId, items);
    return {
      provider: { id: provider.id, name: provider.name, category: provider.category, status: provider.status, live: true },
      items: rows.map(serializeCatalogItem),
      total: rows.length, page, pageSize,
      live: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.provider.update({
      where: { id: providerId },
      data: { status: "ERROR", lastError: msg, lastCheckedAt: new Date() },
    }).catch(() => null);
    throw new ApiError(502, `${provider.name}: ${msg}`);
  }
}

// ─── discover rails — popular listings from live providers, cached as rows ───
export async function discoverCategory(category: string) {
  const providers = await db.provider.findMany({
    where: { installed: true, status: { not: "DISABLED" }, category },
  });
  const rails: { providerId: string; providerName: string; items: ReturnType<typeof serializeCatalogItem>[]; error?: string }[] = [];
  await Promise.all(providers.map(async (p) => {
    const adapter = getLiveAdapter(p.id);
    if (!adapter?.popular) return;
    try {
      const items = await adapter.popular({ page: 1 });
      const rows = await upsertLiveItems(p.id, items.slice(0, 24));
      rails.push({
        providerId: p.id, providerName: p.name,
        items: rows.map(serializeCatalogItem),
      });
    } catch (e) {
      rails.push({
        providerId: p.id, providerName: p.name, items: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }));
  return { category, rails };
}

// ─── lightweight import: catalog row → unified Media without unit fetching ───
// Used by home/browse rails so cards get real slugs immediately. Chapters,
// pages and streams are materialized by the full import path (source pages)
// or lazily resolved by /api/chapters/[id] when a reader opens them.
export async function importLightweight(catalogItemId: string) {
  const item = await db.catalogItem.findUnique({ where: { id: catalogItemId } });
  if (!item) return null;
  const key = item.titleKey || normalizeTitle(item.title);
  const existing = await db.media.findFirst({ where: { titleKey: key, category: item.category } });
  if (existing) {
    const link = await db.providerLink.findUnique({
      where: { providerId_externalId: { providerId: item.providerId, externalId: item.externalId } },
    });
    if (!link) {
      await db.providerLink.create({
        data: { mediaId: existing.id, providerId: item.providerId, externalId: item.externalId, externalUrl: item.externalUrl },
      });
    }
    return existing;
  }

  const accent = accentFor(item.category, key);
  const extra = JSON.parse(item.extra || "{}") as Record<string, unknown>;
  let slug = slugify(item.title) || `item-${item.externalId}`;
  let n = 2;
  while (await db.media.findUnique({ where: { slug } })) slug = `${slugify(item.title) || item.externalId}-${n++}`;

  const externalLinks: { label: string; url: string }[] = [];
  if (item.externalUrl) externalLinks.push({ label: "Open on provider site", url: item.externalUrl });
  if (extra.magnet) externalLinks.push({ label: "Magnet download (external client)", url: String(extra.magnet) });

  return db.media.create({
    data: {
      slug, title: item.title, titleKey: key,
      altTitles: item.altTitles,
      description: item.description,
      coverUrl: proxyUrl(item.coverUrl),
      bannerUrl: proxyUrl(item.bannerUrl),
      accent: accent[0], accent2: accent[1],
      category: item.category, format: item.format, status: item.status,
      year: item.year,
      rating: item.score ?? 0,
      ratingCount: item.popularity ?? 0,
      popularity: item.popularity,
      genres: item.genres, tags: item.tags,
      studio: item.studio, creator: item.creator,
      ageRating: item.ageRating,
      contentFlags: item.category === "AV" ? FLAG_AV : FLAG_MEDIA,
      externalLinks: JSON.stringify(externalLinks),
      extra: JSON.stringify({ ...extra, sourceProvider: item.providerId, importedFrom: item.providerId }),
    },
  });
}

// ─── import: provider catalog item → unified media (with dedup merge) ───
export async function importCatalogItem(catalogItemId: string) {
  const item = await db.catalogItem.findUnique({ where: { id: catalogItemId } });
  if (!item) throw new ApiError(404, "Catalog item not found");
  const provider = await db.provider.findUnique({ where: { id: item.providerId } });
  if (!provider || !provider.installed) throw new ApiError(409, "Install the provider first");
  if (provider.status === "DISABLED") throw new ApiError(409, "Enable the provider first");
  const adapter = getLiveAdapter(item.providerId);

  const key = item.titleKey || normalizeTitle(item.title);
  let media = await db.media.findFirst({ where: { titleKey: key, category: item.category } });

  if (!media) {
    const accent = accentFor(item.category, key);
    const extra = JSON.parse(item.extra || "{}") as Record<string, unknown>;
    let slug = slugify(item.title) || `item-${item.externalId}`;
    let n = 2;
    while (await db.media.findUnique({ where: { slug } })) slug = `${slugify(item.title) || item.externalId}-${n++}`;

    // enrich from the live provider when possible (fresh description etc.)
    let details: LiveSearchItem | null = null;
    if (adapter?.details) {
      details = await adapter.details(item.externalId).catch(() => null);
    }

    const externalLinks: { label: string; url: string }[] = [];
    if (item.externalUrl) externalLinks.push({ label: `Open on ${provider.name}`, url: item.externalUrl });
    if (extra.magnet) externalLinks.push({ label: "Magnet download (external client)", url: String(extra.magnet) });
    for (const l of (extra.externalReadLinks as string[] | undefined) ?? []) {
      externalLinks.push({ label: `External read link (${new URL(l).host})`, url: l });
    }
    if (extra.tier) externalLinks.push({ label: `WholesomeList tier: ${String(extra.tier)}`, url: `https://wholesomelist.com/list/` });

    media = await db.media.create({
      data: {
        slug, title: item.title, titleKey: key,
        altTitles: item.altTitles,
        description: details?.description ?? item.description,
        coverUrl: proxyUrl(details?.coverUrl ?? item.coverUrl),
        bannerUrl: proxyUrl(details?.bannerUrl ?? item.bannerUrl),
        accent: accent[0], accent2: accent[1],
        category: item.category, format: item.format, status: item.status,
        year: item.year,
        rating: details?.score ?? item.score ?? 0,
        ratingCount: item.popularity ?? 0,
        popularity: item.popularity,
        genres: item.genres, tags: item.tags,
        studio: item.studio, creator: item.creator,
        ageRating: item.ageRating,
        contentFlags: item.category === "AV" ? FLAG_AV : FLAG_MEDIA,
        externalLinks: JSON.stringify(externalLinks),
        extra: JSON.stringify({ ...extra, sourceProvider: item.providerId, importedFrom: provider.name }),
      },
    });

    // ── materialize real content units ──
    let units: LiveUnits | null = null;
    if (adapter?.units) {
      units = await adapter.units(item.externalId).catch((e) => {
        console.warn(`[import] units failed for ${item.providerId}/${item.externalId}:`, e instanceof Error ? e.message : e);
        return null;
      });
    }

    for (const ep of units?.episodes ?? []) {
      await db.episode.create({
        data: {
          mediaId: media.id, number: ep.number, title: ep.title ?? null,
          durationSec: ep.durationSec ?? null,
          thumbnailUrl: proxyUrl(ep.thumbnailUrl ?? null),
          streamUrl: ep.streamUrl ? `/api/img?u=${encodeURIComponent(ep.streamUrl)}&stream=1` : null,
          streamType: ep.streamUrl ? "mp4" : "none",
          summary: ep.summary ?? null,
          releasedAt: item.year ? new Date(item.year, 0, 7) : null,
        },
      });
    }

    for (const ch of units?.chapters ?? []) {
      const created = await db.chapter.create({
        data: {
          mediaId: media.id, number: ch.number, title: ch.title ?? null,
          pageCount: ch.pages.length,
          // lazy resolution for single-page-plan chapters (e.g. manga18fx
          // chapter pages): /api/chapters/[id] resolves real images on open.
          sourceProvider: ch.pageKind === "page-url" && ch.pages.length === 1 ? item.providerId : null,
          sourceUrl: ch.pageKind === "page-url" && ch.pages.length === 1 ? ch.pages[0] : null,
          releasedAt: item.year ? new Date(item.year, 0, 7) : null,
        },
      });
      // Multi-page viewer-link chapters (e.g. E-Hentai galleries): store each
      // viewer page — the image proxy resolves final images on demand because
      // upstream CDN keystamps expire.
      if (ch.pages.length > 1) {
        for (let i = 0; i < ch.pages.length; i++) {
          await db.chapterPage.create({
            data: {
              chapterId: created.id, idx: i,
              imageUrl: proxyUrl(ch.pages[i]) ?? ch.pages[i],
            },
          });
        }
      }
    }

    for (const img of units?.images ?? []) {
      await db.galleryImage.create({
        data: {
          mediaId: media.id, idx: 0,
          imageUrl: proxyUrl(img.url) ?? "",
          thumbUrl: proxyUrl(img.thumbUrl),
          width: img.width ?? 800,
          height: img.height ?? 1200,
          tags: JSON.stringify((img.tags ?? []).slice(0, 30)),
        },
      });
    }
  }

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
