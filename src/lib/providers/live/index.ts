// Live adapter registry — maps provider IDs to real implementations.
// Every adapter here has been verified against its upstream from this
// deployment's network before being listed. See docs/INTEGRATIONS.md.

import { anilistAdapter } from "./anilist";
import { e621Adapter, gelbooruAdapter, hypnohubAdapter, yandereAdapter } from "./booru";
import { e621PoolsAdapter } from "./pools";
import { dlsiteAdapter, vndbAdapter } from "./games";
import { ehentaiAdapter, manga18fxAdapter, wholesomelistAdapter } from "./manga";
import { rule34videoAdapter } from "./av";
import { sukebeiAnimeAdapter, sukebeiMangaAdapter } from "./sukebei";
import { wotakuDatabasesAdapter, wotakuMiscAdapter, wotakuScriptsAdapter } from "./wotaku";
import { mangadexAdapter } from "./mangadex";
import { mangaupdatesAdapter } from "./mangaupdates";
import { fansDbAdapter, javStashAdapter, pmvStashAdapter, stashDbAdapter } from "./stashbox";
import { xvideosAdapter } from "./xvideos";
import { epornerAdapter } from "./eporner";
import { hanimeAdapter } from "./hanime";
import { pmvhavenAdapter } from "./pmvhaven";
import { r18devAdapter } from "./r18dev";
import { javdbAdapter } from "./javdb";
import { nhentaiAdapter } from "./nhentai";
import { iwaraAdapter } from "./iwara";
import { hmvmaniaAdapter } from "./hmvmania";
import { hentaioceanAdapter } from "./hentaiocean";
import { nsfwapiAdapter } from "./nsfwapi";
import type { LiveAdapter } from "./types";
import { getExtensionAdapter } from "../ext/repo";

export const LIVE_ADAPTERS: Record<string, LiveAdapter> = {
  anilist: anilistAdapter,
  e621: e621Adapter,
  "e621-pools": e621PoolsAdapter,
  yandere: yandereAdapter,
  hypnohub: hypnohubAdapter,
  gelbooru: gelbooruAdapter,
  ehentai: ehentaiAdapter,
  mangadex: mangadexAdapter,
  mangaupdates: mangaupdatesAdapter,
  wholesomelist: wholesomelistAdapter,
  manga18fx: manga18fxAdapter,
  vndb: vndbAdapter,
  dlsite: dlsiteAdapter,
  rule34video: rule34videoAdapter,
  xvideos: xvideosAdapter,
  eporner: epornerAdapter,
  hanime: hanimeAdapter,
  pmvhaven: pmvhavenAdapter,
  r18dev: r18devAdapter,
  javdb: javdbAdapter,
  stashdb: stashDbAdapter,
  javstash: javStashAdapter,
  fansdb: fansDbAdapter,
  pmvstash: pmvStashAdapter,
  "sukebei-anime": sukebeiAnimeAdapter,
  "sukebei-manga": sukebeiMangaAdapter,
  "wotaku-scripts": wotakuScriptsAdapter,
  "wotaku-misc": wotakuMiscAdapter,
  "wotaku-databases": wotakuDatabasesAdapter,
  nhentai: nhentaiAdapter,
  iwara: iwaraAdapter,
  hmvmania: hmvmaniaAdapter,
  hentaiocean: hentaioceanAdapter,
  nsfwapi: nsfwapiAdapter,
};

export function getLiveAdapter(id: string): LiveAdapter | null {
  return LIVE_ADAPTERS[id] ?? extensionAdapterFor(id);
}

/**
 * Adapters for providers adopted from synced extension repositories.
 * Built on demand from the cached upstream manifest — no code ships for
 * these providers; their declarative recipes are interpreted by
 * src/lib/providers/ext/engine. (No import cycle: ext/repo only pulls
 * live/http and live/types.)
 */
export function extensionAdapterFor(id: string): LiveAdapter | null {
  return getExtensionAdapter(id);
}

export type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";
