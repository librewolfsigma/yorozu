# Hikari (myhikari.in) — Visual Design Study

**Status: REACHABLE ✅** — site studied live on 2025 session date from this sandbox.
**Method:** headless browser (agent-browser/Playwright, Chromium) at 1440×900 and 390×844 + computed-style JS probes + analysis of the site's publicly-served CSS (`hk-ds.css` — literally named "Hikari design language" — plus `home2.css` and inline theme CSS). No content assets were downloaded or copied.

> ⚠️ **Scope note (important):** The brief described the site as an "adult/NSFW streaming site." What is actually live at `myhikari.in` is a **Persian-language (Farsi, RTL) anime/manga community & streaming portal** — dark-themed, AniList-like. No age gate was shown. There is an on-site wiki-adjacent section, and one anomaly was observed: **twice during the session the browser was bounced to `wotaku.wiki/nsfw`** (~15–60 s after landing on the Hikari homepage; `curl` is never affected, and no such redirect exists anywhere in the site's served JS). This looks like anti-bot behavior on the site's side (or a sandbox egress quirk) — it does not affect the design study. All screenshots below were captured during stable windows.

Every claim is tagged **[OBSERVED]** (screenshot / DOM / computed style / served CSS) or **[INFERRED]** (my interpretation for recreation purposes).

---

## 1. Brand snapshot

- Language/dir: `lang="fa" dir="rtl"` — fully RTL layout. Persian digits (۱٬۲۱۹) in UI. **[OBSERVED]**
- Vibe: cozy dark "otaku home base" — deep navy surfaces, one electric-blue accent per section, playful Persian display type (Lalezar), soft glows, poster-fan hero. **[OBSERVED/INFERRED]**
- Site ships its own design-token file (`hk-ds.css`, commented "زبان طراحی هیکاری" = "Hikari design language") with mandated type scale, radii, spacing, and per-section accent colors. **[OBSERVED]**
- A `html.lite` class + `prefers-reduced-motion` rules disable all animation site-wide. **[OBSERVED]**

## 2. Color palette (exact hex)

### Dark theme (default) **[OBSERVED — from live computed styles + served CSS]**

| Token | Hex | Used for |
|---|---|---|
| `--bg` | **#0B1622** | body background (rgb 11,22,34) |
| `--fg` | **#151F2E** | raised surfaces: cards, footer, tabbar, header-solid, selected tab |
| `--line` | **#23324A** | hairline borders, chips, dividers |
| `--text` | **#9FADBD** | body text (15px) |
| `--strong` | **#E4EDF6** | headings, emphasized text, active tab text |
| `--muted` | **#6C8299** | secondary text, inactive tabs, card titles |
| Primary accent `--info`/`--hub` | **#3DB4F2** | primary buttons, active nav, links, highlights |
| Accent deep `--hub2` | **#1E97D8** | hover state of accent |
| On-accent text `--on-hub` | **#04121E** | text/icons placed on accent fills |
| Active-nav pill bg | ≈ **#1B344A** | computed on active nav link (accent 14% mix on surface) |

### Semantic colors **[OBSERVED]**: `--ok:#3DDC84` · `--warn:#F5B544` · `--bad:#EF5B6B` · `--info:#3DB4F2` · `--live:#FF3B5C` · `--rare:#A48BFF`

### Per-section accent system ("hub" colors) **[OBSERVED — this is the site's signature trick]**
`body[data-hub="…"]` retints every active/selected element on that section:

| Section | `--hub` | `--hub2` |
|---|---|---|
| home | #3DB4F2 | #1E97D8 |
| find (search) | #4FB4FF | #2D7CF0 |
| air (schedule) | #3ED6B0 | #1A9C8E |
| top (rankings) | #FFBE4A | #EE8424 |
| cards | #AE8BFF | #7556F0 |
| play | #FF6F91 | #E3436A |
| social | #7C8CFF | #4C5CE8 |
| make (create) | #FF8A4C | #E5582C |
| shop | #3BD47A | #1E9E57 |

Derived tints: `--hub-soft` = accent mixed 14% into surface; `--hub-line` = accent mixed 45% into border color.

### Gradients & glows **[OBSERVED]**
- Hero CTA: `linear-gradient(100deg, #3DB4F2, #8B5CF6)` + glow `0 16px 36px -14px rgba(110,110,255,.95)` + inset top highlight `0 1px 0 rgba(255,255,255,.28)`
- Hero backdrop glow: two radial auroras — violet `rgba(139,92,246,.28)` @ 22%/48%, blue `rgba(61,180,242,.2)` @ 12%/80%
- Header (scrolled): `rgba(21,31,46,.92)` + `backdrop-filter: blur(10px)`
- Detail-page hero is **themed per title** (e.g. One Piece: sky gradient `#1D6FB8 → #56B3E6 → #BFE6F7`, then sea `#1A6FA6 → #0B3E6A`) and retints its tabs/buttons. **[OBSERVED]**
- Premium nav pill: gold gradient `#FFC24B → #FF7A2E` with animated shine sweep. **[OBSERVED]**

### Light theme (exists, secondary) **[OBSERVED from CSS]**: `--bg:#EDF1F5` · `--fg:#FAFBFC` · `--line:#DDE4EB` · `--text:#5C728A` · `--strong:#2E3E52` · `--muted:#8FA3B6`

## 3. Typography

- **Body/UI font:** `"Vazirmatn", Tahoma, "Segoe UI", sans-serif` — weights 300–800, self-hosted. Body 15px / line-height 1.75. **[OBSERVED]**
- **Display font:** `Lalezar` (400) — logo, hero H1, decorative numerals. Hero H1 measured at **190px** with transparent fill + `background-clip:text` gradient. Section H1 on home: 30px/700 #FFF. **[OBSERVED]**
- Type scale (design tokens): `11 / 12.5 / 14 / 16 / 20 / 26 px`, hero `clamp(28px, 3.4vw, 40px)`. **[OBSERVED]**
- Micro-typography: nav links 13.5px/600; tab labels 12.5px/700; card titles 12.5px/700 #6C8299; footer 13px/400; badges 11px/800. **[OBSERVED]**

## 4. Layout structure map

**Container:** max-width **1140px**, side padding 20px. **[OBSERVED]**

### Header (all pages) **[OBSERVED]**
- Fixed top, **60px** tall; transparent over hero → gains `.solid` (surface @92% + blur 10px + shadow `0 2px 10px rgba(0,0,0,.3)`) on scroll.
- Contents (RTL order): logo wordmark (Lalezar + SVG) · nav links: خانه / جستجو / پخش / برترین‌ها / کارت‌ها / بازی‌ها / جامعه / ریلز · "همه‌ی بخش‌های هیکاری (Ctrl+K)" hub-menu · theme toggle · login button (`btn-blue`: #3DB4F2, white text, radius 6, h38, 700 14px).
- Active nav item: pill radius 6, bg accent-14% tint, text in accent color.
- Playful touches: animated mini-icons in some nav items (shine sweep, wiggle keyframes). **[OBSERVED]**

### Homepage (top → bottom) **[OBSERVED — see hikari-home.png]**
1. **Hero ("gh")**: 2-col grid `1.08fr/0.92fr`, gap 40. Left: aurora glow backdrop, H1 (white), big gradient CTA (56px, r16, blue→violet) + secondary underlined link. Right: "poster fan" — 5 covers fanned with rotation, spreads wider on hover. H 400px.
2. **Hottest ("tp")**: section header + segmented tabs (در حال پخش/همیشه محبوب/مانگا) + "همه" button; list rows (see card anatomy) and poster rails.
3. **Toolbox cards**: 2–4 up-tiles (daily discovery, anime of the week, daily puzzle, airing news) with icon wobble on hover.
4. **Cards-collection promo banner** (CTA to card game).
5. **Top-100 poster grid** (6 columns).
6. **Footer** (`hkf`): bg #151F2E, padding `44px 0 20px`, 4 link columns (راهنماها / هیکاری و تو / apps / data sources: AniList, TMDB, MyAnimeList), theme tri-toggle (روشن/تیره/خودکار), scroll-top FAB, floating "community" FAB with notification dot. **[OBSERVED]**

### Section rhythm **[OBSERVED]**
- `.sec` margin-bottom **44px**; `.sec-h` flex baseline, space-between, margin-bottom 14px.
- `.grid` = `repeat(6, minmax(0,1fr))`, gap **22px 20px** (row/col).
- Horizontal poster rails: fixed card width **170px** desktop / **147px** mobile, overflow-x scroll.

### Detail page (e.g. `/anime/21`) **[OBSERVED — see hikari-detail.png]**
- Full-bleed **per-title themed gradient hero** (sky/sea for One Piece), giant Lalezar title (gradient-clipped text), poster card (2/3, r12–14, deep shadow `0 8px 18px -6px rgba(0,0,0,.6)`).
- Action row: primary pill h46 r24 ("درباره‌ی انیمه"), ghost pill on `rgba(255,255,255,.14)`, split "add to list" button (mirrored radii `0 6 6 0` in RTL), round icon buttons (r 50%, h38).
- Content tabs where the **active tab takes the title-theme color**; subsection chips; long scroll of episode/character sections; theme name as a class on the hero (`th-grand-line`). **[OBSERVED]**

### Browse/search page (`/search`) **[OBSERVED — see hikari-browse.png]**
- Search box + "فیلترها" (filters) toggle, filter chips (`ds-chip`: h32 pill, 1px `--line` border, surface bg; active = accent-soft bg + accent-line border).
- Results: 6-col poster grid (170px rails) with count + sort chips row.

## 5. Card component anatomy **[OBSERVED]**

**Poster card (grid/rail):**
- Cover image `aspect-ratio: 2/3`, radius 8–14px, bg fallback `#1B2440`.
- Tile variant (`.tl`): height **184px**, radius **16px**, padding 14px, text bottom-aligned over image, inner ring `inset 0 0 0 1px rgba(255,255,255,.07)`, bg `#141B30`.
- Title below: 12.5px/700, `--muted` #6C8299; subtitle 11px.
- Hover: image `scale(1.05)` over `.7s cubic-bezier(.2,.7,.2,1)`; card lift `translateY(-2/-3px)`; shadow deepens.
- "ds-card" generic: radius 14 (`--r-md`), surface bg, 1px line border, shadow `--elev-1`.

**"Hot" list row:** grid `24px 34px 1fr auto` → rank number (24px), mini poster (34px, r6), title + native title (muted), right-side meta (episode № + countdown, accent text).

**Badges:** pill (999px), bg accent-14% tint, text accent, 11px/800, padding `2px 8px`.

**Buttons:** `ds-btn` h42 r10 700 14px (sm: h34); primary = hub color bg + `#04121E` text, hover = hub2 + white; hero CTA 56px r16 gradient.

## 6. Spacing / radius / shadow conventions **[OBSERVED — the site's own tokens]**

- Spacing scale: **4 / 8 / 12 / 16 / 24 / 32** (`--s-1…--s-6`).
- Radius scale: `--r-xs:4px` · `--r-sm:10px` (buttons, small chips) · `--r-md:14px` (cards) · `--r-lg:20px` · `--r-pill:999px`. (Legacy one-offs observed: 6px nav, 9px tabs, 16px hero CTA/tiles, 24px detail pills.)
- Shadows: `--elev-1: 0 1px 0 rgba(255,255,255,.03) inset, 0 10px 26px -18px rgba(0,0,0,.6)`; `--elev-2: 0 24px 50px -28px rgba(0,0,0,.75)`; header `0 2px 10px rgba(0,0,0,.3)`; CTA glow `0 16px 36px -14px rgba(110,110,255,.95)`. Shadows are large-blur / strongly-negative-spread → soft, grounded depth. **[OBSERVED]**

## 7. Motion & interaction notes **[OBSERVED]**

- Hover lifts: `translateY(-2px)` (cards/buttons), `-3px` (tiles); press: `scale(.97)` / `scale(.94)`.
- Image zoom on hover: `scale(1.05)`, `.7s cubic-bezier(.2,.7,.2,1)`.
- Springy overshoot on some posters: `cubic-bezier(.3,1.5,.5,1)` (bounce), `.4s`.
- General transitions: `.15–.3s` on color/background/transform; theme switch cross-fades `background .6s`.
- Playful ambient animations (with multi-second delays): nav-icon shine sweep (4s), icon wiggle (5s), card "fan" spread on hero hover, tooltip/peek reveals.
- Toasts: fixed bottom, slide-up `opacity/transform .35s` + `env(safe-area-inset-bottom)` offset.
- Accessibility: full `prefers-reduced-motion` support (19 rules) and an in-site "lite" mode (`html.lite`) that kills animations/transitions. **[OBSERVED]**

## 8. Responsive behavior **[OBSERVED]**

- Primary breakpoint **760px**; secondary at 900/1000/1060/1100/1180/1279 for progressive nav condensation (items hide, gaps shrink 6→2px, labels → icons only).
- Poster grid columns: **6 → 5 (≤1060px) → 4 → 3 (mobile)**; rails become fixed-width horizontal scrollers (147px cards).
- Mobile: fixed **bottom tabbar**, 56px, bg #151F2E, 4 items (خانه/جستجو/ریلز/برنامه), active item in accent #3DB4F2; toasts lifted above it with safe-area inset.
- Hero: single column, art block moves to top (`order:-1`, 210px), text centered.
- RTL is native: shadows/splits mirrored, `translateX(-4px)` = "forward" affordance. **[OBSERVED]**

## 9. "How to recreate this vibe" checklist (aesthetic only — write original code)

1. **Base:** near-black navy `#0B1622`, one surface step `#151F2E`, hairline `#23324A`; 3-step text ramp `#9FADBD / #E4EDF6 / #6C8299`. Never pure black/white.
2. **Accent:** one electric blue `#3DB4F2` default, plus a small set of per-section accent pairs (teal/amber/purple/pink/indigo) applied *only* to active/selected/primary elements — users should "know where they are by color alone" (the site states this goal in its own CSS comments).
3. **Type:** pair a friendly humanist text face (Vazirmatn for Farsi; Inter/Nunito Sans for a Latin clone) with a loud single-weight display face (Lalezar; e.g. Baloo 2 / Righteous for Latin) reserved for logo + hero.
4. **Chrome:** 60px fixed header that turns into blurred glass on scroll; 1140px container; 44px section rhythm with baseline-aligned headers and a "view all" link.
5. **Cards:** 2/3 posters, r14, inset white ring at 7%, hover = lift −2px + image zoom 1.05 (.7s, ease-out-back allowed), muted 12.5px/700 titles.
6. **One loud CTA:** 56px tall, r16, blue→violet gradient, violet glow shadow, inset top highlight; everything else stays quiet/surface-toned.
7. **Detail pages get identity:** derive a gradient "sky" + accent from the item's cover colors and retint tabs/CTAs per item.
8. **Motion budget:** 0.15–0.3s micro-lifts, ≤0.7s zooms, 2–3 ambient keyframes max, `prefers-reduced-motion` + a lite mode.
9. **Mobile:** bottom 56px tabbar (4 items), 3-col grid, 147px scroll rails, safe-area padding.
10. **Keep RTL in mind** even for LTR clones: use logical properties (`margin-inline`, `inset-inline`) so mirroring is free.

## 10. Screenshots index (this folder)

| File | What | Size |
|---|---|---|
| `hikari-home.png` | Homepage, desktop, full page | 1440×3544 |
| `hikari-home-viewport.png` | Homepage hero + header, desktop | 1440×900 |
| `hikari-home-mobile.png` | Homepage, mobile, full page | 390×3875 |
| `hikari-browse.png` | Search/browse page, desktop, full page | 1440×2871 |
| `hikari-detail.png` | Detail page (`/anime/21`), desktop, full page | 1440×16597 |
| `hikari-header.png` | Header close-up, desktop | 1440×900 |
| `hikari-footer.png` | Footer close-up, desktop | 1440×900 |

Supporting evidence: `tools/hikari-hk-ds.css` (site's own design-system file), `tools/hikari-inline.css` (inline theme CSS extracted from HTML), `tools/hikari-home2.css` (homepage styles), `tokens-home.json` (computed-style probe dump), `tools/probe1.js` (probe script).

## 11. Caveats

- **[INFERRED]** judgments: vibe descriptions, recreation substitutions (Latin fonts), and any mapping between `data-hub` names and English labels.
- Light theme was verified from served CSS, not re-screenshotted (theme toggle didn't apply during automation).
- Only page structure/CSS was analyzed; no media content was downloaded or reproduced. Recreations should use original code, original artwork, and licensed fonts (both Vazirmatn and Lalezar are SIL OFL).
