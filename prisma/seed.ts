/**
 * Yozora database seeder — REAL INTEGRATIONS EDITION.
 *
 * Seeds only:
 *  1. The real provider adapters (installed by default)
 *  2. A ready-to-use demo account
 *
 * NO fictional titles, NO placeholder pages, NO fake providers.
 * All catalog content is fetched live from the integrated providers at
 * request time (see src/lib/providers/live/). Unified Media rows are created
 * on demand from those live results.
 */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const db = new PrismaClient();

async function main() {
  console.log("Seeding Yozora (real integrations)…");

  // ── Providers (real, verified adapters) ──
  const { PROVIDER_REGISTRY, DEFAULT_INSTALLED } = await import("../src/lib/providers/registry");
  for (const def of PROVIDER_REGISTRY) {
    const installed = DEFAULT_INSTALLED.includes(def.id);
    await db.provider.upsert({
      where: { id: def.id },
      create: {
        id: def.id, name: def.name, category: def.category,
        description: def.description, version: def.version, author: def.author,
        homepage: def.homepage,
        capabilities: JSON.stringify(def.capabilities),
        configSchema: JSON.stringify(def.configSchema),
        config: JSON.stringify({}),
        status: "ACTIVE", installed,
      },
      update: {
        name: def.name, category: def.category, description: def.description,
        version: def.version, author: def.author, homepage: def.homepage,
        capabilities: JSON.stringify(def.capabilities),
        configSchema: JSON.stringify(def.configSchema),
      },
    });
  }
  console.log(`  ✓ ${PROVIDER_REGISTRY.length} real providers registered (${DEFAULT_INSTALLED.length} installed)`);

  // ── Demo account ──
  const passwordHash = hashPassword("demo1234");
  await db.user.upsert({
    where: { username: "demo" },
    create: {
      username: "demo",
      displayName: "Demo User",
      bio: "Exploring Yozora's real provider integrations.",
      isDemo: true,
      passwordHash,
      ageVerifiedAt: new Date(),
    },
    update: {},
  });
  console.log("  ✓ demo account ready (demo / demo1234)");

  // ── Purge any legacy fictional seed data ──
  // (Older builds materialized deterministic placeholder content. Real
  // integrations replaced it; remove any leftovers so the UI never shows
  // fictional titles.)
  const removed = await db.media.deleteMany({
    where: { links: { none: {} } }, // unified media with no real provider link
  });
  if (removed.count) console.log(`  ✓ purged ${removed.count} legacy unlinked media rows`);
  const removedChars = await db.mediaCharacter.deleteMany({});
  const removedPeople = await db.mediaPerson.deleteMany({});
  const removedCharRows = await db.character.deleteMany({});
  const removedPersonRows = await db.person.deleteMany({});
  const removedTagDefs = await db.tagDef.deleteMany({});
  if (removedCharRows.count || removedPersonRows.count || removedTagDefs.count) {
    console.log(`  ✓ purged fictional metadata (${removedCharRows.count} characters, ${removedPersonRows.count} people, ${removedTagDefs.count} tagdefs)`);
  }
  const removedCatalog = await db.catalogItem.deleteMany({
    where: { provider: { id: { in: ["aoistream", "kurostream", "inkscans", "sakurascan", "seoulink", "webtoonvault", "inkvault", "arthaven", "nightflix", "rubytube", "playvault", "velvetstore", "scriptforge", "resourcebase"] } } },
  });
  if (removedCatalog.count) console.log(`  ✓ purged ${removedCatalog.count} fictional catalog rows`);
  await db.provider.deleteMany({
    where: { id: { in: ["aoistream", "kurostream", "inkscans", "sakurascan", "seoulink", "webtoonvault", "inkvault", "arthaven", "nightflix", "rubytube", "playvault", "velvetstore", "scriptforge", "resourcebase"] } },
  });

  console.log("Done. Content is fetched live from providers — no fictional data seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
