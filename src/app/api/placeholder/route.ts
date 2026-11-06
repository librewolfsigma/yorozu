import { NextRequest, NextResponse } from "next/server";
import { hashString, mulberry32 } from "@/lib/content-factory";

/**
 * Deterministic SVG placeholder generator.
 * Produces abstract, non-explicit artwork for covers, reader pages, gallery
 * images, banners, thumbnails and avatars — so the platform ships zero
 * explicit media while every reader/player/gallery flow stays functional.
 */

const ACCENT_FALLBACKS = ["#3DB4F2", "#FF6F91", "#AE8BFF", "#3ED6B0", "#FFBE4A", "#FF8A4C", "#3BD47A", "#A48BFF"];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function darken(hex: string, f: number): string {
  const m = hex.replace("#", "");
  const r = Math.round(parseInt(m.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(m.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(m.slice(4, 6), 16) * f);
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

function wrapTitle(title: string, maxChars: number, maxLines: number): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur.trim());
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length + 2) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, "") + "…";
  }
  return lines;
}

function noiseDefs(id: string, accent: string, rand: () => number, w: number, h: number): string {
  const gid = `g${id}`;
  const glowX = Math.round(w * (0.25 + rand() * 0.5));
  const glowY = Math.round(h * (0.2 + rand() * 0.4));
  const r = Math.round(Math.min(w, h) * (0.5 + rand() * 0.3));
  return `
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${darken(accent, 0.16)}"/>
      <stop offset="0.55" stop-color="#10192a"/>
      <stop offset="1" stop-color="#0B1622"/>
    </linearGradient>
    <radialGradient id="${gid}r" cx="${(glowX / w).toFixed(2)}" cy="${(glowY / h).toFixed(2)}" r="0.75">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="0.5" stop-color="${accent}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="${gid}d" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(${Math.round(rand() * 60)})">
      <circle cx="3" cy="3" r="1.1" fill="${accent}" opacity="0.13"/>
    </pattern>
    <filter id="${gid}n">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
    <filter id="${gid}b"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) / 14)}"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${gid})"/>
  <ellipse cx="${glowX}" cy="${glowY}" rx="${r}" ry="${Math.round(r * (0.55 + rand() * 0.3))}" fill="url(#${gid}r)"/>
  <rect width="${w}" height="${h}" fill="url(#${gid}d)"/>`;
}

function abstractBlobs(id: string, accent: string, rand: () => number, w: number, h: number, n = 3): string {
  const gid = `g${id}`;
  let out = `<g filter="url(#${gid}b)" opacity="0.5">`;
  for (let i = 0; i < n; i++) {
    const cx = Math.round(rand() * w);
    const cy = Math.round(rand() * h);
    const rx = Math.round(w * (0.12 + rand() * 0.22));
    const ry = Math.round(h * (0.1 + rand() * 0.2));
    const c = i % 2 === 0 ? accent : darken(accent, 0.6);
    out += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${(0.25 + rand() * 0.35).toFixed(2)}"/>`;
  }
  out += "</g>";
  return out;
}

function ringBadge(x: number, y: number, r: number, accent: string): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>
  <circle cx="${x}" cy="${y}" r="${r * 0.65}" fill="none" stroke="${accent}" stroke-opacity="0.18" stroke-width="1.5"/>`;
}

function renderCover(rand: () => number, w: number, h: number, accent: string, title: string, category: string): string {
  const id = Math.floor(rand() * 1e6).toString(36);
  const lines = wrapTitle(title, 14, 3);
  const bandY = Math.round(h * (0.62 + rand() * 0.12));
  const fontSize = Math.max(16, Math.round(w / 11));
  const startY = bandY + Math.round(h * 0.06);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${noiseDefs(id, accent, rand, w, h)}
  ${abstractBlobs(id + "c", accent, rand, w, h * 0.6, 3)}
  <path d="M0 ${bandY} L${w} ${bandY - Math.round(h * 0.05)} L${w} ${h} L0 ${h} Z" fill="#0d1522" opacity="0.82"/>
  <rect x="0" y="${bandY - Math.round(h * 0.05)}" width="${w}" height="3" fill="${accent}" opacity="0.9"/>
  ${ringBadge(Math.round(w * (0.12 + rand() * 0.2)), Math.round(h * (0.12 + rand() * 0.12)), Math.round(Math.min(w, h) * 0.09), accent)}
  <text x="${Math.round(w * 0.08)}" y="${Math.round(h * 0.09)}" font-family="sans-serif" font-size="${Math.max(10, Math.round(w / 22))}" font-weight="800" fill="${accent}" letter-spacing="2">${esc(category.slice(0, 12))}</text>
  ${lines.map((l, i) => `<text x="${Math.round(w * 0.08)}" y="${startY + i * Math.round(fontSize * 1.25)}" font-family="sans-serif" font-size="${fontSize}" font-weight="700" fill="#E4EDF6">${esc(l)}</text>`).join("")}
  <text x="${Math.round(w * 0.08)}" y="${h - Math.round(h * 0.05)}" font-family="sans-serif" font-size="${Math.max(9, Math.round(w / 26))}" font-weight="700" fill="#6C8299" letter-spacing="1.5">YOZORA · 18+</text>
  <rect width="${w}" height="${h}" filter="url(#${id}n)" fill="transparent" opacity="0.5"/>
  <rect width="${w}" height="${h}" fill="none" stroke="#23324A" stroke-width="2"/>
</svg>`;
}

function renderBanner(rand: () => number, w: number, h: number, accent: string, title: string): string {
  const id = Math.floor(rand() * 1e6).toString(36);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${noiseDefs(id, accent, rand, w, h)}
  ${abstractBlobs(id + "b", accent, rand, w, h, 5)}
  <text x="${Math.round(w * 0.05)}" y="${Math.round(h * 0.9)}" font-family="sans-serif" font-size="${Math.max(18, Math.round(h / 10))}" font-weight="800" fill="#E4EDF6" opacity="0.9">${esc(wrapTitle(title, 40, 1)[0] ?? "")}</text>
  <rect width="${w}" height="${h}" filter="url(#${id}n)" fill="transparent" opacity="0.5"/>
</svg>`;
}

function renderPage(rand: () => number, w: number, h: number, label: string): string {
  const paper = "#f4f1ea";
  const ink = "#20242c";
  const m = Math.round(w * 0.05);
  const innerW = w - m * 2;
  const innerH = h - m * 2;
  const rows = 2 + Math.floor(rand() * 3);
  let panels = "";
  let y = m;
  const gutter = Math.round(w * 0.025);
  for (let r = 0; r < rows; r++) {
    const rowH = Math.round((innerH - gutter * (rows - 1)) / rows * (r === rows - 1 ? 1.15 : 0.9));
    const cols = 1 + Math.floor(rand() * 2.4);
    let x = m;
    const colWs: number[] = [];
    for (let c = 0; c < cols; c++) {
      const cw = c === cols - 1
        ? innerW - colWs.reduce((a, b) => a + b, 0) - gutter * (cols - 1)
        : Math.round(innerW / cols * (0.75 + rand() * 0.5));
      colWs.push(cw);
    }
    for (let c = 0; c < cols; c++) {
      const cw = colWs[c];
      const tone = rand();
      const fill = tone < 0.25 ? darken("#3DB4F2", 0.35) : tone < 0.5 ? "#dfe6ee" : tone < 0.7 ? "#cfd6e0" : "#e8ebee";
      panels += `<rect x="${x}" y="${y}" width="${cw}" height="${rowH}" fill="${fill}" stroke="${ink}" stroke-width="${Math.max(2, Math.round(w / 200))}"/>`;
      if (rand() < 0.5) {
        panels += `<line x1="${x + 4}" y1="${y + rowH * 0.75}" x2="${x + cw - 4}" y2="${y + rowH * 0.72}" stroke="${ink}" stroke-opacity="0.18" stroke-width="2"/>`;
      }
      x += cw + gutter;
    }
    y += rowH + gutter;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${paper}"/>
  ${panels}
  <text x="${m}" y="${h - Math.round(h * 0.02)}" font-family="sans-serif" font-size="${Math.max(10, Math.round(w / 30))}" fill="#8a93a3">${esc(label)}</text>
  <text x="${w - m}" y="${h - Math.round(h * 0.02)}" text-anchor="end" font-family="sans-serif" font-size="${Math.max(9, Math.round(w / 40))}" fill="#b3bac6">YOZORA DEMO</text>
</svg>`;
}

function renderGallery(rand: () => number, w: number, h: number, accent: string): string {
  const id = Math.floor(rand() * 1e6).toString(36);
  const rings = 1 + Math.floor(rand() * 3);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${noiseDefs(id, accent, rand, w, h)}
  ${abstractBlobs(id + "g", accent, rand, w, h, 4)}`;
  for (let i = 0; i < rings; i++) {
    out += ringBadge(Math.round(w * (0.2 + rand() * 0.6)), Math.round(h * (0.2 + rand() * 0.5)), Math.round(Math.min(w, h) * (0.08 + rand() * 0.12)), accent);
  }
  out += `<path d="M0 ${Math.round(h * 0.85)} Q ${Math.round(w * 0.3)} ${Math.round(h * (0.72 + rand() * 0.1))} ${Math.round(w * 0.55)} ${Math.round(h * 0.84)} T ${w} ${Math.round(h * 0.8)} L ${w} ${h} L 0 ${h} Z" fill="${darken(accent, 0.4)}" opacity="0.4"/>
  <text x="${Math.round(w * 0.06)}" y="${h - Math.round(h * 0.04)}" font-family="serif" font-size="${Math.max(12, Math.round(w / 24))}" fill="#E4EDF6" opacity="0.85" font-style="italic">yozora gallery</text>
  <rect width="${w}" height="${h}" filter="url(#${id}n)" fill="transparent" opacity="0.5"/>
  </svg>`;
  return out;
}

function renderThumb(rand: () => number, w: number, h: number, accent: string, label: string): string {
  const id = Math.floor(rand() * 1e6).toString(36);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${noiseDefs(id, accent, rand, w, h)}
  <polygon points="${Math.round(w * 0.42)},${Math.round(h * 0.28)} ${Math.round(w * 0.42)},${Math.round(h * 0.72)} ${Math.round(w * 0.62)},${Math.round(h * 0.5)}" fill="#E4EDF6" opacity="0.9"/>
  ${label ? `<text x="${Math.round(w * 0.05)}" y="${Math.round(h * 0.14)}" font-family="sans-serif" font-size="${Math.max(11, Math.round(h / 7))}" font-weight="800" fill="#E4EDF6">${esc(label)}</text>` : ""}
  <rect width="${w}" height="${h}" filter="url(#${id}n)" fill="transparent" opacity="0.4"/>
</svg>`;
}

function renderAvatar(rand: () => number, w: number, h: number, label: string): string {
  const accents = ["#3DB4F2", "#AE8BFF", "#FF6F91", "#3ED6B0", "#FFBE4A", "#FF8A4C"];
  const accent = accents[Math.floor(rand() * accents.length)];
  const id = Math.floor(rand() * 1e6).toString(36);
  const initial = (label || "?").slice(0, 1).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${darken(accent, 0.45)}"/>
  </linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#${id})"/>
  <circle cx="${w * 0.8}" cy="${h * 0.2}" r="${w * 0.3}" fill="#ffffff" opacity="0.08"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(w * 0.5)}" font-weight="800" fill="#ffffff">${esc(initial)}</text>
</svg>`;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") ?? "cover";
  const seed = sp.get("seed") ?? "yozora";
  const title = sp.get("title") ?? sp.get("label") ?? "";
  const label = sp.get("label") ?? "";
  const accentParam = sp.get("accent");
  const category = sp.get("category") ?? "";
  const w = Math.min(2000, Math.max(64, parseInt(sp.get("w") ?? "0", 10) || 0));
  const h = Math.min(4000, Math.max(64, parseInt(sp.get("h") ?? "0", 10) || 0));

  const rand = mulberry32(hashString(`${type}:${seed}`));
  const accent = accentParam && /^#[0-9a-fA-F]{6}$/.test(accentParam)
    ? accentParam
    : ACCENT_FALLBACKS[hashString(seed) % ACCENT_FALLBACKS.length];

  let svg: string;
  switch (type) {
    case "banner":
      svg = renderBanner(rand, w || 1600, h || 640, accent, title);
      break;
    case "page":
      svg = renderPage(rand, w || 800, h || 1200, label || title);
      break;
    case "gallery":
      svg = renderGallery(rand, w || 900, h || 1300, accent);
      break;
    case "thumb":
      svg = renderThumb(rand, w || 480, h || 270, accent, label || title);
      break;
    case "avatar":
      svg = renderAvatar(rand, w || 160, h || 160, label || title);
      break;
    case "cover":
    default:
      svg = renderCover(rand, w || 400, h || 600, accent, title, category);
      break;
  }

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
