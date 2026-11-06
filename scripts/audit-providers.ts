/* Real-request smoke test — ALL registered Yozora live adapters.
   Run: bun .smoke/smoke.ts "query" */
import { LIVE_ADAPTERS } from "@/lib/providers/live";

const q = process.argv[2] || "fate";
const targets = Object.keys(LIVE_ADAPTERS);
console.log(`Probing ${targets.length} adapters with q="${q}"\n`);

let ok = 0, warn = 0, fail = 0;
for (const id of targets) {
  const a = LIVE_ADAPTERS[id];
  try {
    await a.ping();                                            // real health probe
    const items = await a.search(q, { page: 1 });              // real network search
    const f = items[0];
    let pop = "n/a";
    if (a.popular) {
      try {
        const p = await a.popular({ page: 1 });
        pop = `${p.length} hits`;
      } catch (e: unknown) { pop = `ERR ${(e as Error).message?.slice(0, 60)}`; }
    }
    const cfgHint = /config|api.?key/i.test(a.integration) && items.length === 0;
    const tag = cfgHint ? "WARN" : "OK";
    if (cfgHint) warn++; else ok++;
    console.log(
      `${tag} ${id} (search:${items.length}, popular:${pop}) -> ${f ? JSON.stringify({
        title: f.title, extId: f.externalId, cover: !!f.coverUrl, extUrl: f.externalUrl, year: f.year ?? null,
      }).slice(0, 230) : "EMPTY"}`,
    );
  } catch (e: unknown) {
    fail++;
    console.log(`X ${id}: ${(e as Error).message?.slice(0, 150)}`);
  }
}
console.log(`\nRESULT: ${ok} ok / ${warn} warn / ${fail} fail of ${targets.length}`);
