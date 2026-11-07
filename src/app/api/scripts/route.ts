import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import { cached, TTL } from "@/lib/cache";
import { discoverCategory } from "@/lib/providers/engine";
import type { WorkDTO } from "@/lib/serialize";

// Userscript/tool catalog — fetched LIVE from the Wotaku directory provider
// on every request (TTL-cached in memory, never persisted). The platform
// tracks only the user's install decisions and NEVER executes third-party code.
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    const discovery = await cached("scripts", "wotaku-scripts", TTL.LISTINGS, () => discoverCategory("SCRIPT")).catch(() => null);
    const items: WorkDTO[] = discovery?.rails.flatMap((r) => r.items) ?? [];
    const installs = user ? await db.scriptInstall.findMany({ where: { userId: user.id } }) : [];
    return NextResponse.json({
      scripts: items.map((s) => {
        const install = installs.find((i) => i.providerId === s.provider && i.externalId === s.externalId);
        return {
          ...s,
          install: install ? { enabled: install.enabled, installedAt: install.installedAt } : null,
        };
      }),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to manage scripts.");
    const body = await readJson<{ provider?: string; externalId?: string; title?: string; action?: string }>(req);
    if (!body.provider || !body.externalId || !body.action) {
      throw new ApiError(400, "provider, externalId and action are required");
    }
    const refWhere = { userId: user.id, providerId: body.provider, externalId: body.externalId };
    const where = { userId_providerId_externalId: refWhere };

    if (body.action === "install") {
      const existing = await db.scriptInstall.findUnique({ where });
      if (!existing) {
        await db.scriptInstall.create({
          data: {
            userId: user.id, providerId: body.provider, externalId: body.externalId,
            titleSnapshot: body.title ?? `Script ${body.externalId}`,
          },
        });
        await db.notification.create({
          data: { userId: user.id, type: "SUCCESS", title: `Tracked ${body.title ?? "script"}`, body: "Bookmark only — Yozora never executes third-party code; scripts run in your own userscript manager.", link: "#/scripts" },
        }).catch(() => null);
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "uninstall") {
      await db.scriptInstall.deleteMany({ where: refWhere });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "toggle") {
      const existing = await db.scriptInstall.findUnique({ where });
      if (!existing) throw new ApiError(404, "Not installed");
      await db.scriptInstall.update({ where: { id: existing.id }, data: { enabled: !existing.enabled } });
      return NextResponse.json({ ok: true });
    }

    throw new ApiError(400, "Unknown action");
  });
}
