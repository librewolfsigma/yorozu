import { NextRequest, NextResponse } from "next/server";
import { hashString, mulberry32 } from "@/lib/content-factory";

/**
 * Deterministic letter-avatar generator (USER AVATARS ONLY).
 * The original placeholder artwork pipeline (covers / reader pages / gallery
 * images / banners) was removed when Yozora switched to real provider data —
 * media artwork now comes exclusively from integrated providers.
 */

const ACCENTS = ["#3DB4F2", "#FF6F91", "#AE8BFF", "#3ED6B0", "#FFBE4A", "#FF8A4C", "#3BD47A", "#A48BFF"];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");
  if (type !== "avatar") {
    return NextResponse.json(
      { error: "Only avatar placeholders are generated. Media artwork comes from live providers." },
      { status: 404 },
    );
  }
  const seed = sp.get("seed") ?? "user";
  const label = (sp.get("label") ?? "U").slice(0, 2).toUpperCase();
  const accent = ACCENTS[hashString(seed) % ACCENTS.length];
  const rand = mulberry32(hashString(seed));
  const deg = Math.floor(rand() * 360);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <defs><linearGradient id="g" gradientTransform="rotate(${deg} 0.5 0.5)">
    <stop offset="0%" stop-color="${accent}"/>
    <stop offset="100%" stop-color="#0B1622"/>
  </linearGradient></defs>
  <rect width="160" height="160" fill="url(#g)"/>
  <text x="80" y="80" dy="0.36em" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="64" font-weight="700" fill="#FFFFFF" opacity="0.92">${label}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" },
  });
}
