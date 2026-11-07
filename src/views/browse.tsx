"use client";

// Live browse — INFINITE SCROLL over a paged multi-provider feed.
//
// Every page pulls the next upstream page from every usable provider in the
// category (round-robin interleaved, external-ref deduped) via /api/feed.
// Nothing is stored locally: when a provider adds new items upstream, the
// next page pull surfaces them here.
//
// TAXONOMY: Manga / Doujin / Manhwa are distinct categories; single booru
// images (ILLUSTRATION) render with the dedicated Danbooru-style browser
// instead of this grid; AV subcategory tabs stay distinct.

import { useInfiniteQuery } from "@tanstack/react-query";
import { PackageOpen, AlertTriangle, Puzzle, ChevronDown, ChevronRight, RefreshCw, Layers, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { categoryMeta, VIDEO_KINDS, CATEGORIES } from "@/lib/category-meta";
import { MediaCard, GridSkeleton, fromDTO } from "@/components/media/card";
import type { WorkDTO } from "@/lib/serialize";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import BooruView from "@/views/booru";

interface FeedResponse {
  category: string;
  kind: string | null;
  q: string;
  page: number;
  items: WorkDTO[];
  hasMore: boolean;
  providers: { id: string; name: string; error: string | null; count: number }[];
}

export default function BrowseView({ category, query }: { category?: string; query: URLSearchParams }) {
  // No category → the category index (also the mobile "Browse" landing).
  if (!category) return <CategoryIndex />;
  // Single booru images get their own Danbooru-style UI entirely.
  if (category === "ILLUSTRATION") return <BooruView tag={query.get("q") ?? ""} />;
  return <FeedBrowser category={category} kind={query.get("kind") ?? ""} />;
}

// ─── Category index ─────────────────────────────────────────────────────────

function CategoryIndex() {
  return (
    <div className="pb-6">
      <h1 className="font-display text-3xl text-white">Browse</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Every category, live from installed providers — infinite scroll, nothing stored locally.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => navigate(`/browse/${c.key}`)}
            className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg press-scale"
            style={{ ["--hub" as string]: c.hub }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hub-soft" style={{ color: c.hub }}>
              <c.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-bold">{c.label}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{categoryBlurb(c.key)}</span>
            </span>
            <ChevronRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function categoryBlurb(key: string): string {
  const blurbs: Record<string, string> = {
    ANIME: "Streams & metadata · AniList, Sukebei",
    MANGA: "Serialized manga · MangaDex, MangaUpdates",
    DOUJIN: "Doujinshi galleries · E-Hentai, WholesomeList, Sukebei",
    MANHWA: "Webtoons · Manga18fx",
    ILLUSTRATION: "Single booru images · e621, yande.re, Hypnohub",
    GALLERY: "Curated image collections · e621 Pools",
    AV: "AV / JAV · PMV · HMV · Hentai scenes",
    GAME: "Visual novels & doujin games · VNDB, DLsite",
    SCRIPT: "Userscripts & tools",
    DATABASE: "Metadata databases directory",
    MISC: "Guides & reference",
  };
  return blurbs[key] ?? "";
}

// ─── Infinite feed browser ──────────────────────────────────────────────────

function FeedBrowser({ category, kind }: { category: string; kind: string }) {
  const meta = categoryMeta(category);
  const isAV = category === "AV";
  const activeKind = VIDEO_KINDS.find((k) => k.key === kind) ?? VIDEO_KINDS[0];

  const q = useInfiniteQuery({
    queryKey: ["feed", category, kind],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<FeedResponse>(
        `/api/feed?category=${encodeURIComponent(category)}${kind ? `&kind=${encodeURIComponent(kind)}` : ""}&page=${pageParam}`,
      ),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const flat: WorkDTO[] = [];
    for (const page of q.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.ref)) continue;
        seen.add(item.ref);
        flat.push(item);
      }
    }
    return flat;
  }, [q.data]);

  const providers = q.data?.pages.at(-1)?.providers ?? [];
  const failedProviders = providers.filter((p) => p.error);
  const [showErrors, setShowErrors] = useState(false);
  const allFailed = !q.isLoading && q.isSuccess && items.length === 0 && providers.length > 0 && providers.every((p) => p.error);

  // IntersectionObserver sentinel — the infinite part
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage, items.length]);

  return (
    <div className="pb-6" style={{ ["--hub" as string]: meta.hub }}>
      {/* header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl hub-soft" style={{ color: meta.hub }}>
          <meta.icon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-3xl text-white">{meta.label}</h1>
          <p className="text-[13px] text-muted-foreground">
            Live from installed providers — infinite scroll, nothing is stored locally.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-lg border-border bg-card"
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", q.isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* AV subcategory tabs — AV/JAV/PMV/HMV/CREATOR stay DISTINCT by design */}
      {isAV && (
        <div className="mb-6">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {VIDEO_KINDS.map((k) => {
              const isActive = k.key === kind;
              return (
                <button
                  key={k.key || "all"}
                  onClick={() => navigate(`/browse/AV${k.key ? `?kind=${encodeURIComponent(k.key)}` : ""}`)}
                  className={cn(
                    "flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all",
                    isActive ? "border-transparent" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                  style={isActive ? { background: `${meta.hub}1f`, color: meta.hub, borderColor: `${meta.hub}55` } : undefined}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{activeKind.blurb}</p>
        </div>
      )}

      {/* source health strip — honest per-provider status on every page */}
      {!q.isLoading && providers.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-card px-4 py-2.5">
          {providers.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground" title={p.error ?? `${p.count} live items from ${p.name}`}>
              <span className={cn("h-2 w-2 rounded-full", p.error ? "bg-[#EF5B6B]" : p.count > 0 ? "bg-[#3BD47A]" : "bg-muted-foreground/40")} />
              {p.name}
              <span className="font-normal">· {p.error ? "failed" : p.count}</span>
            </span>
          ))}
          {failedProviders.length > 0 && (
            <button
              onClick={() => setShowErrors((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-bold text-[#FF8B96]"
              aria-expanded={showErrors}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {failedProviders.length} source {failedProviders.length === 1 ? "error" : "errors"}
              <ChevronDown className={cn("h-3 w-3 transition-transform", showErrors && "rotate-180")} />
            </button>
          )}
        </div>
      )}
      {showErrors && failedProviders.length > 0 && (
        <div className="mb-5 space-y-1.5">
          {failedProviders.map((p) => (
            <p key={p.id} className="flex items-start gap-1.5 rounded-lg border border-[#EF5B6B]/25 bg-[#EF5B6B]/10 p-2.5 text-xs text-[#FF8B96]">
              <span className="font-semibold">{p.name}:</span>
              <span className="min-w-0 break-words">{p.error}</span>
            </p>
          ))}
        </div>
      )}

      {/* the feed */}
      {q.isError ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-[#EF5B6B]/40 py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-[#EF5B6B]" />
          <p className="mt-3 font-semibold">Could not load this feed</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{(q.error as Error)?.message}</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => void q.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : allFailed ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Every source failed for this category</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            The errors above come straight from the providers — check Extensions for health details or try again later.
          </p>
        </div>
      ) : items.length === 0 && q.isLoading ? (
        <GridSkeleton count={12} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Puzzle className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No providers installed for {meta.label}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Install a source in Extensions to pull live listings for this category.
          </p>
          <button
            onClick={() => navigate("/extensions")}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-bold text-[#04121E] cta-gradient press-scale"
          >
            Open Extensions
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {items.map((item) => (
              <MediaCard key={item.ref} media={fromDTO(item)} />
            ))}
          </div>

          {/* infinite scroll sentinel + states */}
          <div ref={sentinelRef} aria-hidden className="h-1" />
          <div className="mt-6 flex items-center justify-center gap-2 pb-2 text-sm text-muted-foreground" aria-live="polite">
            {q.isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading more from providers…
              </>
            ) : q.hasNextPage ? (
              <button onClick={() => void q.fetchNextPage()} className="rounded-lg px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground">
                Load more
              </button>
            ) : (
              <>
                <Layers className="h-4 w-4" /> You reached the end of what providers currently list — new items appear automatically as sources add them.
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
