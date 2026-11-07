"use client";

// Mihon-style source page — the provider IS the browse surface.
// Popular listings stream in as an INFINITE scroll (page N is a genuine
// upstream page-N fetch), and the in-source search box switches to upstream
// text search. Nothing is stored locally.

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, RefreshCw, AlertTriangle, KeyRound, Loader2, Layers } from "lucide-react";
import { api } from "@/lib/client-api";
import { categoryMeta } from "@/lib/category-meta";
import { MediaGrid, GridSkeleton, fromDTO } from "@/components/media/card";
import type { WorkDTO } from "@/lib/serialize";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";

interface SourcePage {
  provider: {
    id: string;
    name: string;
    category: string;
    status: string;
    configRequired: boolean;
  };
  items: WorkDTO[];
  error: string | null;
  hasMore: boolean;
  total: number;
  page: number;
  live: boolean;
}

export default function SourceView({ providerId }: { providerId?: string }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [lastProviderId, setLastProviderId] = useState(providerId);

  // Fresh source → fresh search state (the view instance is reused across routes).
  if (lastProviderId !== providerId) {
    setLastProviderId(providerId);
    setQ("");
    setDebouncedQ("");
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const feed = useInfiniteQuery({
    queryKey: ["provider-source", providerId, debouncedQ],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<SourcePage>(
        `/api/providers/${providerId}?q=${encodeURIComponent(debouncedQ)}&page=${pageParam}`,
      ),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!providerId,
    retry: 1,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const flat: WorkDTO[] = [];
    for (const page of feed.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.ref)) continue;
        seen.add(item.ref);
        flat.push(item);
      }
    }
    return flat;
  }, [feed.data]);

  const lastPage = feed.data?.pages.at(-1);
  const provider = lastPage?.provider;
  const firstError = feed.data?.pages.find((p) => p.error)?.error ?? null;
  const meta = provider ? categoryMeta(provider.category) : categoryMeta("MISC");

  // IntersectionObserver sentinel — the infinite part
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) {
          void feed.fetchNextPage();
        }
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage, items.length]);

  if (!providerId) {
    return (
      <div className="pb-6">
        <h1 className="font-display text-3xl text-white">Source</h1>
        <p className="mt-2 text-sm text-muted-foreground">Pick a source from the directory first.</p>
        <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => navigate("/sources")}>
          Open Sources
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-6" style={{ ["--hub" as string]: meta.hub }}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground" onClick={() => navigate("/sources")}>
          <ArrowLeft className="h-4 w-4" /> Sources
        </Button>
        {provider && (
          <a
            href="#/extensions"
            className="text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Manage in Extensions
          </a>
        )}
      </div>

      {/* provider header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl hub-soft" style={{ color: meta.hub }}>
          <meta.icon className="h-5.5 w-5.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl text-white">
            {provider?.name ?? "Source"}
            {provider?.status === "ACTIVE" && !provider.configRequired && (
              <span className="rounded-full bg-[#3BD47A]/15 px-2 py-0.5 align-middle text-[10px] font-bold text-[#3BD47A]">live</span>
            )}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {debouncedQ ? "Upstream search results" : "Popular listings"} · infinite scroll, fetched live, nothing stored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-44 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search this source…"
              className="h-9 rounded-lg bg-card pl-8"
              aria-label={`Search ${provider?.name ?? "source"}`}
            />
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Refresh" onClick={() => void feed.refetch()}>
            <RefreshCw className={cn("h-4 w-4", feed.isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* config warning — honest: required keys are missing */}
      {provider?.configRequired && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-[#FFBE4A]/30 bg-[#FFBE4A]/10 p-3 text-xs text-foreground/85">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#FFBE4A]" />
          <span>
            This source requires your free API key before it can serve results.{" "}
            <a href="#/extensions" className="font-bold text-[#FFBE4A] underline-offset-2 hover:underline">
              Configure it in Extensions
            </a>
            .
          </span>
        </div>
      )}

      {/* upstream error — shown verbatim, never papered over */}
      {(firstError || feed.isError) && (
        <p className="mb-5 flex items-start gap-1.5 rounded-lg border border-[#EF5B6B]/25 bg-[#EF5B6B]/10 p-3 text-xs text-[#FF8B96]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{feed.isError ? (feed.error as Error)?.message : firstError}</span>
        </p>
      )}

      {/* grid */}
      {feed.isLoading ? (
        <GridSkeleton count={12} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Search className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">{debouncedQ ? "No results on this source" : "Nothing to show yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {debouncedQ
              ? "The provider returned no matches for this query."
              : "This source may need a query, or its upstream is not listing anything right now."}
          </p>
        </div>
      ) : (
        <div className={cn("transition-opacity", feed.isFetching && "opacity-90")}>
          <MediaGrid items={items.map(fromDTO)} />
        </div>
      )}

      {/* infinite scroll sentinel + states */}
      <div ref={sentinelRef} aria-hidden className="h-1" />
      {items.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-2 pb-2 text-sm text-muted-foreground" aria-live="polite">
          {feed.isFetchingNextPage ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading more from {provider?.name ?? "source"}…
            </>
          ) : feed.hasNextPage ? (
            <button
              onClick={() => void feed.fetchNextPage()}
              className="rounded-lg px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground"
            >
              Load more
            </button>
          ) : (
            <>
              <Layers className="h-4 w-4" /> End of what this source currently lists — new items appear automatically.
            </>
          )}
        </div>
      )}
    </div>
  );
}
