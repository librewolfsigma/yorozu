import { LIVE_ADAPTERS } from "@/lib/providers/live";
const a = LIVE_ADAPTERS["mangadex"]!;
const res = await a.search("fate", { page: 1 });
const target = res.find(x => x.title.toLowerCase().includes("fate"));
if (!target) { console.log("no target"); process.exit(1); }
console.log("series:", target.title, target.externalId);
const units = await a.units!(target.externalId);
console.log("chapters:", units?.chapters?.length, "first:", units?.chapters?.[0]);
const token = units?.chapters?.[0]?.pages[0] ?? "";
const images = await a.resolveChapter!(token);
console.log("resolved pages:", images.length);
console.log("first page URL:", images[0]);
// fetch the first image bytes through the same host the proxy would use
const u = new URL(images[0]);
const img = await fetch(images[0], { headers: { "User-Agent": "Mozilla/5.0" } });
console.log("image fetch:", img.status, img.headers.get("content-type"), "host:", u.hostname);
