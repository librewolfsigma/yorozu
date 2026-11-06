import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import { serializeCatalogItem } from "@/lib/serialize";

// Userscript/extension catalog + per-user installs.
// The platform tracks installs and permissions but NEVER executes third-party code.
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    const scripts = await db.catalogItem.findMany({
      where: { category: "SCRIPT" },
      include: { provider: { select: { id: true, name: true, installed: true, status: true } } },
      orderBy: { popularity: "desc" },
    });
    const installs = user
      ? await db.scriptInstall.findMany({ where: { userId: user.id } })
      : [];
    return NextResponse.json({
      scripts: scripts.map((s) => ({
        ...serializeCatalogItem(s),
        provider: { id: s.provider.id, name: s.provider.name, installed: s.provider.installed, status: s.provider.status },
        install: installs.find((i) => i.scriptId === s.id)
          ? { enabled: installs.find((i) => i.scriptId === s.id)!.enabled, installedAt: installs.find((i) => i.scriptId === s.id)!.installedAt }
          : null,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in to manage scripts.");
    const body = await readJson<{ scriptId?: string; action?: string }>(req);
    if (!body.scriptId || !body.action) throw new ApiError(400, "scriptId and action required");
    const script = await db.catalogItem.findUnique({ where: { id: body.scriptId }, include: { provider: true } });
    if (!script || script.category !== "SCRIPT") throw new ApiError(404, "Script not found");

    if (body.action === "install") {
      if (!script.provider.installed) throw new ApiError(409, "Install the ScriptForge provider first.");
      const extra = JSON.parse(script.extra) as { permissions?: { domain: string }[] };
      const existing = await db.scriptInstall.findUnique({
        where: { userId_scriptId: { userId: user.id, scriptId: script.id } },
      });
      if (!existing) {
        await db.scriptInstall.create({
          data: {
            userId: user.id, scriptId: script.id,
            grantedPermissions: JSON.stringify((extra.permissions ?? []).map((p) => p.domain)),
          },
        });
        await db.notification.create({
          data: { userId: user.id, type: "SUCCESS", title: `Installed ${script.title}`, body: "Sandboxed: the script is metadata-only and is never executed by the platform.", link: "#/scripts" },
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "uninstall") {
      await db.scriptInstall.deleteMany({ where: { userId: user.id, scriptId: script.id } });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "toggle") {
      const existing = await db.scriptInstall.findUnique({
        where: { userId_scriptId: { userId: user.id, scriptId: script.id } },
      });
      if (!existing) throw new ApiError(404, "Not installed");
      await db.scriptInstall.update({ where: { id: existing.id }, data: { enabled: !existing.enabled } });
      return NextResponse.json({ ok: true });
    }

    throw new ApiError(400, "Unknown action");
  });
}
