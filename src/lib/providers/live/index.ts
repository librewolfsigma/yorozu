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
import type { LiveAdapter } from "./types";

export const LIVE_ADAPTERS: Record<string, LiveAdapter> = {
  anilist: anilistAdapter,
  e621: e621Adapter,
  yandere: yandereAdapter,
  hypnohub: hypnohubAdapter,
  gelbooru: gelbooruAdapter,
  ehentai: ehentaiAdapter,
  wholesomelist: wholesomelistAdapter,
  manga18fx: manga18fxAdapter,
  vndb: vndbAdapter,
  dlsite: dlsiteAdapter,
  rule34video: rule34videoAdapter,
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
