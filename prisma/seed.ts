/**
 * Yozora database seeder — CLIENT-FIRST EDITION.
 *
 * Seeds only:
 *  1. Provider overlay rows for the real adapters (install state/config)
 *  2. A ready-to-use demo account
 *
 * NO catalog content exists in this database at all — every work, unit and
 * image is fetched live from its provider at request time
 * (see docs/CLIENT_ARCHITECTURE.md).
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
  console.log("Seeding Yozora (client-first)…");

  const { PROVIDER_REGISTRY, DEFAULT_INSTALLED } = await import("../src/lib/providers/registry");
  for (const def of PROVIDER_REGISTRY) {
    const installed = DEFAULT_INSTALLED.includes(def.id);
    await db.provider.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        installed,
        status: "ACTIVE",
        config: JSON.stringify({}),
      },
      update: { installed },
    });
  }
  console.log(`  ✓ ${PROVIDER_REGISTRY.length} provider overlay rows ready (${DEFAULT_INSTALLED.length} installed)`);

  const passwordHash = hashPassword("demo1234");
  await db.user.upsert({
    where: { username: "demo" },
    create: {
      username: "demo",
      displayName: "Demo User",
      bio: "Exploring Yozora as a universal client.",
      isDemo: true,
      passwordHash,
      ageVerifiedAt: new Date(),
    },
    update: {},
  });
  console.log("  ✓ demo account ready (demo / demo1234)");

  console.log("Done. The database holds no media catalog — content is fetched live from providers.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
