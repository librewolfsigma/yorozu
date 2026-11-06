import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import { BROWSER_UA, isAllowedMediaUrl, refererFor } from "@/lib/imgproxy";

// Real file delivery for a download row: streams the actual provider-hosted
// bytes with Content-Disposition: attachment. Status/size are recorded from
// the real transfer. No simulated progress exists anywhere.

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in first.", { status: 401 });
  const { id } = await ctx.params;
  const row = await db.download.findUnique({ where: { id } });
  if (!row || row.userId !== user.id) return new NextResponse("Download not found", { status: 404 });

  // Stored URLs may already be proxy-wrapped (/api/img?u=…) — unwrap them.
  let sourceUrl = row.path ?? "";
  if (sourceUrl.startsWith("/api/img?u=")) {
    try {
      sourceUrl = new URL(sourceUrl, "http://localhost").searchParams.get("u") ?? "";
    } catch { sourceUrl = ""; }
  }
  if (!sourceUrl || !isAllowedMediaUrl(sourceUrl)) {
    await db.download.update({ where: { id }, data: { status: "ERROR", error: "Source URL missing or not allowlisted." } });
    return new NextResponse("Source URL missing or not allowlisted.", { status: 409 });
  }

  try {
    await db.download.update({ where: { id }, data: { status: "RUNNING", startedAt: new Date(), error: null } });
    const upstream = await fetch(sourceUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        ...(refererFor(sourceUrl) ? { Referer: refererFor(sourceUrl)! } : {}),
        Accept: "*/*",
      },
      redirect: "follow",
    });
    if (!upstream.ok || !upstream.body) throw new Error(`Upstream ${upstream.status}`);

    const buf = Buffer.from(await upstream.arrayBuffer());
    const ext = (upstream.headers.get("content-type") ?? "").includes("webp") ? "webp"
      : (upstream.headers.get("content-type") ?? "").includes("png") ? "png"
      : (upstream.headers.get("content-type") ?? "").includes("mp4") ? "mp4" : "jpg";
    const safeName = `${row.label.replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 60)}.${ext}`;

    await db.download.update({
      where: { id },
      data: { status: "DONE", progress: 1, sizeBytes: buf.byteLength, completedAt: new Date(), speedBps: 0 },
    });
    await db.notification.create({
      data: { userId: user.id, type: "SUCCESS", title: "Download complete", body: `${row.label} (${Math.round(buf.byteLength / 1024)} KB)`, link: "#/downloads" },
    });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Content-Length": String(buf.byteLength),
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.download.update({ where: { id }, data: { status: "ERROR", error: msg.slice(0, 250) } });
    return new NextResponse(`Download failed: ${msg}`, { status: 502 });
  }
}

// pause/resume are not meaningful for direct streamed downloads — the
// endpoint rejects them honestly instead of simulating progress.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const { id } = await ctx.params;
    const row = await db.download.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) throw new ApiError(404, "Download not found");
    const body = await readJson<{ action?: string }>(req);

    switch (body.action) {
      case "cancel":
        await db.download.delete({ where: { id } });
        break;
      case "retry":
        if (!row.path) throw new ApiError(409, "Nothing to retry — no source file recorded.");
        await db.download.update({ where: { id }, data: { status: "QUEUED", error: null, completedAt: null } });
        break;
      case "pause":
      case "resume":
        throw new ApiError(409, "Streaming downloads transfer directly to your browser — pause/resume is not applicable.");
      default:
        throw new ApiError(400, "Unknown action");
    }
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sign in first.");
    const { id } = await ctx.params;
    const row = await db.download.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) throw new ApiError(404, "Download not found");
    await db.download.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
