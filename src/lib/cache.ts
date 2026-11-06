// Bounded in-memory TTL cache — the ONLY caching layer in Yozora.
//
// Client-first architecture: upstream responses are memoized briefly so
// browsing feels fast, but nothing is ever persisted. Clearing this cache
// loses nothing; every entry is refetchable from its provider.
//
// Properties:
//   - per-namespace TTL (search 5 min, details 5 min, pages 5 min, rails 10 min)
//   - bounded size with oldest-entry eviction (no unbounded growth)
//   - single-flight per key (concurrent requests share one upstream call)

type Entry = { value: unknown; expiresAt: number };

const MAX_ENTRIES = 600;
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

function evictIfNeeded() {
  while (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

export async function cached<T>(namespace: string, key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const fullKey = `${namespace}:${key}`;
  const hit = store.get(fullKey);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  // single-flight: concurrent callers share one upstream request
  const pending = inflight.get(fullKey);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    const value = await fetcher();
    store.set(fullKey, { value, expiresAt: Date.now() + ttlMs });
    evictIfNeeded();
    return value;
  })().finally(() => inflight.delete(fullKey));

  inflight.set(fullKey, p);
  return p as Promise<T>;
}

export function invalidateNamespace(namespace: string) {
  for (const k of store.keys()) {
    if (k.startsWith(`${namespace}:`)) store.delete(k);
  }
}

export function cacheStats() {
  return { entries: store.size, inflight: inflight.size, maxEntries: MAX_ENTRIES };
}

// TTL presets (kept short — cache is a convenience, not a replica)
export const TTL = {
  SEARCH: 5 * 60 * 1000,
  RAILS: 10 * 60 * 1000,
  WORK: 5 * 60 * 1000,
  PAGES: 5 * 60 * 1000, // strictly shorter than MangaDex at-home expiry (~15 min)
  LISTINGS: 10 * 60 * 1000, // scripts/databases directories
} as const;
