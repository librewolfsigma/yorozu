/* Real-request audit of ALL registered Yozora live adapters.
   Run: bun scripts/audit-providers.ts "query"
   For each adapter: ping() → search(q) → popular() with REAL network calls.
   Config-gated providers are expected to 401 without keys — that's the
   honest gate, not a failure. */
import { LIVE_ADAPTERS } from "@/lib/providers/live";

const q = process.argv[2] || "fate";
const targets = process.argv[3] ? process.argv[3].split(",") : Object.keys(LIVE_ADAPTERS);
console.log(`Auditing ${targets.length} adapters with q="${q}"\n`);

let ok = 0, gated = 0, fail = 0;
const gatedHint = /REQUIRES A FREE API KEY|requires a FREE account API key/i;

for (const id of targets) {
  const a = LIVE_ADAPTERS[id];
  if (!a) { console.log(`X ${id}: NOT REGISTERED`); fail++; continue; }
  try {
    await a.ping();
    const items = await a.search(q, { page: 1 });
    const f = items[0];
    let pop = "n/a";
    if (a.popular) {
      try {
        const p = await a.popular({ page: 1 });
        pop = `${p.length} hits`;
      } catch (e: unknown) { pop = `ERR ${(e as Error).message?.slice(0, 60)}`; }
    }
    console.log(
      `OK ${id} (search:${items.length}, popular:${pop}) -> ${f ? JSON.stringify({
        title: f.title, extId: f.externalId, cover: !!f.coverUrl, extUrl: f.externalUrl, year: f.year ?? null,
      }).slice(0, 230) : "EMPTY"}`,
    );
    ok++;
  } catch (e: unknown) {
    const msg = (e as Error).message ?? String(e);
    if (gatedHint.test(msg) || (e as { status?: number }).status === 401) {
      gated++;
      console.log(`GATED ${id}: ${msg.slice(0, 140)}`);
    } else {
      fail++;
      console.log(`X ${id}: ${msg.slice(0, 150)}`);
    }
  }
}
console.log(`\nRESULT: ${ok} ok / ${gated} config-gated (expected without keys) / ${fail} fail of ${targets.length}`);
