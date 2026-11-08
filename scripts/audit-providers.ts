/* Real-request audit of ALL registered Yozora live adapters.
   Run: bun scripts/audit-providers.ts "query"
   For each adapter: ping() → search(q) → popular() with REAL network calls.
   Config-gated providers are expected to 401 without keys — that's the
   honest gate, not a failure. */
import { LIVE_ADAPTERS, extensionAdapterFor } from "@/lib/providers/live";
import { ensureExtensionManifests, listExtensionDefs } from "@/lib/providers/ext/repo";

const q = process.argv[2] || "fate";
await ensureExtensionManifests(); // cold-start extension adoption (non-fatal)
const extIds = listExtensionDefs().map((d) => d.id);
const ALL = { ...LIVE_ADAPTERS, ...Object.fromEntries(extIds.map((id) => [id, extensionAdapterFor(id)!])) };
const targets = process.argv[3] ? process.argv[3].split(",") : Object.keys(ALL);
console.log(`Auditing ${targets.length} adapters with q="${q}"\n`);

let ok = 0, gated = 0, fail = 0;
const gatedHint = /REQUIRES A FREE API KEY|requires a FREE account API key/i;

const SEARCHLESS = /does not support text search|does not cover video posts|search-only source|no text search upstream|exposes no popular/i;

for (const id of targets) {
  const a = ALL[id];
  if (!a) { console.log(`X ${id}: NOT REGISTERED`); fail++; continue; }
  try {
    await a.ping();
    // BROWSE first — it is the core capability; text search is optional and
    // honestly absent on several sources (verified upstream limits).
    let pop = "n/a";
    let popCount = 0;
    if (a.popular) {
      try {
        const p = await a.popular({ page: 1 });
        popCount = p.length;
        pop = `${popCount} hits`;
      } catch (e: unknown) { pop = `ERR ${(e as Error).message?.slice(0, 60)}`; }
    }
    // SEARCH is reported as a note, not a failure, when upstream doesn't offer it.
    let searchNote = "";
    let first: unknown = null;
    try {
      const items = await a.search(q, { page: 1 });
      first = items[0];
      searchNote = `search:${items.length}`;
    } catch (e: unknown) {
      const m = (e as Error).message ?? String(e);
      searchNote = SEARCHLESS.test(m) ? "search:none (honest)" : `search:ERR ${m.slice(0, 60)}`;
      if (!SEARCHLESS.test(m) && popCount === 0) throw e; // nothing works at all
    }
    if (a.popular && pop.startsWith("ERR") && !first) throw new Error(`popular failed: ${pop}`);
    const f = (first ?? null) as { title?: string; externalId?: string; coverUrl?: string; externalUrl?: string; year?: number | null } | null;
    console.log(
      `OK ${id} (${searchNote}, popular:${pop}) -> ${f ? JSON.stringify({
        title: f.title, extId: f.externalId, cover: !!f.coverUrl, extUrl: f.externalUrl, year: f.year ?? null,
      }).slice(0, 230) : "browse-only"}`,
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
