// Live audit of the new + fixed adapters — run with: bun scripts/audit-new-av.ts
import { xvideosAdapter } from "../src/lib/providers/live/xvideos";
import { epornerAdapter } from "../src/lib/providers/live/eporner";
import { hanimeAdapter } from "../src/lib/providers/live/hanime";
import { pmvhavenAdapter } from "../src/lib/providers/live/pmvhaven";
import { r18devAdapter } from "../src/lib/providers/live/r18dev";
import { javdbAdapter } from "../src/lib/providers/live/javdb";
import { rule34videoAdapter } from "../src/lib/providers/live/av";
import type { LiveAdapter } from "../src/lib/providers/live/types";

const short = (s: unknown, n = 90) => String(s ?? "").slice(0, n).replace(/\s+/g, " ");

async function audit(name: string, a: LiveAdapter, searchQ: string, detailId: string) {
  const line = (s: string) => console.log(`  ${s}`);
  console.log(`\n== ${name} ==`);
  try {
    await a.ping();
    line(`ping ✓`);
  } catch (e) { line(`ping ✗ ${String(e).slice(0, 120)}`); }
  try {
    const items = await a.search(searchQ);
    line(`search("${searchQ}") → ${items.length} items | first: ${short(items[0]?.title)} | kind: ${items[0]?.videoKind}`);
  } catch (e) { line(`search ✗ ${String(e).slice(0, 140)}`); }
  if (a.popular) {
    try {
      const items = await a.popular({ page: 1 });
      line(`popular → ${items.length} items | first: ${short(items[0]?.title)}`);
    } catch (e) { line(`popular ✗ ${String(e).slice(0, 140)}`); }
  }
  if (a.details) {
    try {
      const d = await a.details(detailId);
      line(`details(${detailId}) → ${d ? short(d.title, 60) : "null"} | cover: ${short(d?.coverUrl, 50)}`);
    } catch (e) { line(`details ✗ ${String(e).slice(0, 140)}`); }
  }
  if (a.units) {
    try {
      const u = await a.units(detailId);
      const ep = u?.episodes?.[0];
      line(`units(${detailId}) → ${ep ? `stream ✓ ${ep.streamType} ${short(ep.streamUrl, 70)}` : "no stream"}`);
    } catch (e) { line(`units ✗ ${String(e).slice(0, 140)}`); }
  }
}

// detail ids from live probes
await audit("r18dev", r18devAdapter, "MIDE-500", "MIDE-500");
await audit("pmvhaven", pmvhavenAdapter, "pmv", (await pmvhavenAdapter.popular!({ page: 1 }))?.[0]?.externalId ?? "");
await audit("eporner", epornerAdapter, "pmv", (await epornerAdapter.search("pmv", { page: 2 }))?.[0]?.externalId ?? "Tot6CWRUesR");
await audit("xvideos", xvideosAdapter, "jav", (await xvideosAdapter.search("jav"))?.[0]?.externalId ?? "");
await audit("javdb", javdbAdapter, "SSIS-700", (await javdbAdapter.search("SSIS-700"))?.[0]?.externalId ?? "");
await audit("hanime", hanimeAdapter, "", (await hanimeAdapter.popular!())?.[0]?.externalId ?? "");
await audit("rule34video", rule34videoAdapter, "hentai", (await rule34videoAdapter.popular!())?.[0]?.externalId ?? "");
