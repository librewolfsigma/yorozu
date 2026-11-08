"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, PackageOpen, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/client-api";
import { MediaCard, GridSkeleton, fromDTO } from "@/components/media/card";
import { CATEGORIES } from "@/lib/category-meta";
import type { WorkDTO } from "@/lib/serialize";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

interface SearchResponse {
  q: string;
  page: number;
  providerResults: WorkDTO[];
  groups: Record<string, { provider: { id: string; name: string; status: string }; items: WorkDTO[] }>;
  providerErrors: { provider: string; error: string }[];
  total: number;
}

// Live fan-out search: every installed provider is queried per request and the
// flat result list is deduped on external refs. PAGINATED: "Load more" pulls
// the next upstream page from every provider (infinite scroll). Nothing hits
// a local catalog.
export default function SearchView({ query }: { query: URLSearchParams }) {
  const q = query.get("q") ?? "";
  const [category, setCategory] = useState(query.get("category") ?? "");

  const search = useInfiniteQuery({
    queryKey: ["search", q, category],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<SearchResponse>(
        `/api/search?q=${encodeURIComponent(q)}${category ? `&category=${encodeURIComponent(category)}` : ""}&page=${pageParam}`,
      ),
    getNextPageParam: (last) => (last.total > 0 ? last.page + 1 : undefined),
    enabled: q.length > 0,
  });

  const results = useMemo(() => {
    const seen = new Set<string>();
    const flat: WorkDTO[] = [];
    for (const page of search.data?.pages ?? []) {
      for (const item of page.providerResults) {
        if (seen.has(item.ref)) continue;
        seen.add(item.ref);
        flat.push(item);
      }
    }
    return flat;
  }, [search.data]);

  const latest = search.data?.pages.at(-1);
  const providerErrors = search.data?.pages.flatMap((p) => p.providerErrors) ?? [];
  const providersOk = latest ? Object.keys(latest.groups).length : 0;

  // infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [search.hasNextPage, search.isFetchingNextPage, search.fetchNextPage, results.length]);

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Search className="h-10 w-10 text-muted-foreground" />
        <p className="mt-4 font-semibold">Type something to search</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Search queries every installed provider live — results are never stored locally.
        </p>
      </div>
    );
  }

  const providersOkCount = search.data ? providersOk : 0;

  return (
    <div className="pb-6">
      <h1 className="font-display text-3xl text-white">
        Results for <span className="text-primary">“{q}”</span>
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {search.isPending
          ? "Searching live across installed providers…"
          : search.data
            ? `${results.length} results from ${providersOkCount} provider${providersOkCount === 1 ? "" : "s"} · nothing is stored locally`
            : ""}
      </p>

      {/* category filter chips */}
      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto">
        <FilterChip label="All" active={category === ""} onClick={() => setCategory("")} />
        {CATEGORIES.map((c) => (
          <FilterChip key={c.key} label={c.label} active={category === c.key} onClick={() => setCategory(c.key)} />
        ))}
      </div>

      {search.isPending ? (
        <div className="mt-6"><GridSkeleton count={12} /></div>
      ) : (
        <>
          {results.length > 0 ? (
            <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {results.map((w) => (
                <MediaCard
                  key={w.ref}
                  media={fromDTO(w)}
                  footer={
                    <span className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-[#3BD47A]" />
                      <span className="truncate">{w.providerName}</span>
                    </span>
                  }
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border py-14 text-center">
              <PackageOpen className="h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-semibold">No results from any installed provider</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Search runs live against provider APIs — try a different query, another category, or install more sources in Extensions.
              </p>
            </div>
          )}

          {/* infinite scroll sentinel + states */}
          {results.length > 0 && (
            <>
              <div ref={sentinelRef} aria-hidden className="h-1" />
              <div className="mt-6 flex items-center justify-center gap-2 pb-2 text-sm text-muted-foreground" aria-live="polite">
                {search.isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading more results…
                  </>
                ) : search.hasNextPage ? (
                  <button onClick={() => void search.fetchNextPage()} className="rounded-lg px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground">
                    Load more
                  </button>
                ) : (
                  <p className="text-[13px]">End of upstream results for this query.</p>
                )}
              </div>
            </>
          )}

          {search.isError && (
            <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-[#EF5B6B]/40 py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-[#EF5B6B]" />
              <p className="mt-2 font-semibold">Search failed</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{(search.error as Error)?.message}</p>
              <button onClick={() => void search.refetch()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-4 py-2 text-sm font-bold text-primary">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          )}

          {/* honest provider error panel */}
          {providerErrors.length > 0 && (
            <section className="mt-8" aria-label="Provider errors">
              <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-[#FF8B96]">
                <AlertTriangle className="h-3.5 w-3.5" />
                {providerErrors.length} provider{providerErrors.length === 1 ? "" : "s"} failed during this search
              </h2>
              <div className="space-y-1.5">
                {providerErrors.map((e, i) => (
                  <p
                    key={`${e.provider}:${i}`}
                    className="flex items-start gap-1.5 rounded-lg border border-[#EF5B6B]/25 bg-[#EF5B6B]/10 p-2.5 text-xs text-[#FF8B96]"
                  >
                    <span className="font-semibold">{e.provider}:</span>
                    <span className="min-w-0 break-words">{e.error}</span>
                  </p>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all",
        active ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
