import { NextRequest, NextResponse } from "next/server";

// Letter-avatar placeholder (user avatars only — media artwork always comes
// from the real provider). Deterministic per seed.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const label = (sp.get("label") ?? "Y").slice(0, 2).toUpperCase();
  const seed = sp.get("seed") ?? "yozora";
  const size = Math.min(512, Math.max(16, parseInt(sp.get("w") ?? "160", 10) || 160));
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = hash % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 160 160">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue},45%,38%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},50%,26%)"/>
  </linearGradient></defs>
  <rect width="160" height="160" fill="url(#g)"/>
  <text x="80" y="80" dy="0.36em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="64" font-weight="700" fill="rgba(255,255,255,0.92)">${label}</text>
</svg>`;
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
