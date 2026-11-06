// Live adapter registry — maps provider IDs to real implementations.
// Every adapter here has been verified against its upstream from this
// deployment's network before being listed. See docs/INTEGRATIONS.md.

import { anilistAdapter } from "./anilist";
import { e621Adapter, gelbooruAdapter, hypnohubAdapter, yandereAdapter } from "./booru";
import { dlsiteAdapter, vndbAdapter } from "./games";
import { ehentaiAdapter, manga18fxAdapter, wholesomelistAdapter } from "./manga";
import { rule34videoAdapter } from "./av";
import { sukebeiAnimeAdapter, sukebeiMangaAdapter } from "./sukebei";
import { wotakuDatabasesAdapter, wotakuMiscAdapter, wotakuScriptsAdapter } from "./wotaku";
import { mangadexAdapter } from "./mangadex";
import { mangaupdatesAdapter } from "./mangaupdates";
import { anidbAdapter } from "./anidb";
import { fansDbAdapter, javStashAdapter, pmvStashAdapter, stashDbAdapter } from "./stashbox";
import type { LiveAdapter } from "./types";

export const LIVE_ADAPTERS: Record<string, LiveAdapter> = {
  anilist: anilistAdapter,
  anidb: anidbAdapter,
  e621: e621Adapter,
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
  stashdb: stashDbAdapter,
  javstash: javStashAdapter,
  fansdb: fansDbAdapter,
  pmvstash: pmvStashAdapter,
  "sukebei-anime": sukebeiAnimeAdapter,
  "sukebei-manga": sukebeiMangaAdapter,
  "wotaku-scripts": wotakuScriptsAdapter,
  "wotaku-misc": wotakuMiscAdapter,
  "wotaku-databases": wotakuDatabasesAdapter,
};

export function getLiveAdapter(id: string): LiveAdapter | null {
  return LIVE_ADAPTERS[id] ?? null;
}

export type { LiveAdapter, LiveSearchItem, LiveUnits } from "./types";
