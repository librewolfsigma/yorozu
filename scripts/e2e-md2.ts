import { LIVE_ADAPTERS } from "@/lib/providers/live";
const a = LIVE_ADAPTERS["mangadex"]!;
const fresh = await fetch("https://api.mangadex.org/at-home/server/9aaa0af2-ba3b-4b44-bc25-ea1cc9d4ff14", { headers: { "User-Agent": "YozoraPlatform/1.0" } }).then(r => r.json()) as { baseUrl: string; chapter: { hash: string; data: string[] } };
const url = `${fresh.baseUrl}/data/${fresh.chapter.hash}/${fresh.chapter.data[0]}`;
console.log("URL:", url);
for (const [label, headers] of [
  ["no-headers", {}],
  ["ua-only", { "User-Agent": "YozoraPlatform/1.0" }],
  ["browser", { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0" }],
  ["referer", { "User-Agent": "Mozilla/5.0", "Referer": "https://mangadex.org/" }],
] as [string, Record<string,string>][]) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    console.log(label, "->", r.status, r.headers.get("content-type"));
  } catch (e) { console.log(label, "-> ERR", (e as Error).message.slice(0, 80)); }
}
