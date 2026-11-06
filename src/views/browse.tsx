"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SlidersHorizontal, X, Search, PackageOpen, Plus, Check, Loader2,
  AlertTriangle, Radio, Star,
} from "lucide-react";
import { api, post } from "@/lib/client-api";
import { categoryMeta } from "@/lib/category-meta";
import { MediaGrid, GridSkeleton, fromDTO } from "@/components/media/card";
import type { MediaDTO } from "@/lib/serialize";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface BrowseResponse {
  items: MediaDTO[];
  total: number;
  page: number;
  pageSize: number;
  facets: { genres: { name: string; count: number }[]; years: number[] } | null;
}

// Catalog item as returned by GET /api/discover/[category] — no slug yet;
// importing creates the unified Media row and returns its slug.
interface CatalogItem {
  id: string; providerId: string; externalId: string; title: string;
  description: string | null; coverUrl: string | null; bannerUrl: string | null;
  accent: string | null; category: string; format: string | null;
  status: string | null; year: number | null; score: number | null;
  popularity: number; genres: string[]; tags: string[];
  studio: string | null; creator: string | null;
  externalUrl: string | null; extra: Record<string, unknown>;
  episodesCount: number | null; chaptersCount: number | null;
  galleryCount: number | null; imported: boolean;
}

interface DiscoverResponse {
  category: string;
  rails: { providerId: string; providerName: string; items: CatalogItem[]; error?: string }[];
}

const SORTS = [
  { key: "POPULAR", label: "Most popular" },
  { key: "RATING", label: "Top rated" },
  { key: "NEWEST", label: "Recently added" },
  { key: "YEAR", label: "Newest releases" },
  { key: "TITLE", label: "A → Z" },
];

export default function BrowseView({ category, query }: { category?: string; query: URLSearchParams }) {
  const meta = categoryMeta(category ?? "MISC");
  const qParam = query.get("q") ?? "";
  const [q, setQ] = useState(qParam);
  const [lastQParam, setLastQParam] = useState(qParam);
  const [debouncedQ, setDebouncedQ] = useState(qParam);
  const [genres, setGenres] = useState<string[]>([]);
  const [year, setYear] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [videoKind, setVideoKind] = useState<string>("all");
  const [sort, setSort] = useState("POPULAR");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // adjust state during render when the incoming query param changes
  if (lastQParam !== qParam) {
    setLastQParam(qParam);
    setQ(qParam);
    setDebouncedQ(qParam);
    setPage(1);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const resetPage = () => setPage(1);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (debouncedQ) p.set("q", debouncedQ);
    if (genres.length) p.set("genres", genres.join(","));
    if (year !== "all") p.set("year", year);
    if (status !== "all") p.set("status", status);
    if (category === "AV" && videoKind !== "all") p.set("videoKind", videoKind);
    p.set("sort", sort);
    p.set("page", String(page));
    p.set("pageSize", "24");
    return p.toString();
  }, [category, debouncedQ, genres, year, status, videoKind, sort, page]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["browse", params],
    queryFn: () => api<BrowseResponse>(`/api/media?${params}`),
  });

  // Live discover rails: real "popular" listings pulled from every installed
  // provider in this category. Kept separate from the local database rows below.
  const discover = useQuery({
    queryKey: ["discover", category],
    queryFn: () => api<DiscoverResponse>(`/api/discover/${category}`),
    enabled: !!category,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const toggleGenre = (g: string) => {
    resetPage();
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

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
            {data ? `${data.total} titles` : "Loading…"} · unified database across all providers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${meta.label.toLowerCase()}…`}
              className="h-9 rounded-lg bg-card pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg gap-1.5 border-border"
            onClick={() => setShowFilters((s) => !s)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
            {(genres.length > 0 || year !== "all" || status !== "all") && (
              <span className="ml-0.5 rounded-full bg-[#3DB4F2] px-1.5 text-[10px] font-bold text-[#04121E]">
                {genres.length + (year !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0)}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* filter panel */}
      {showFilters && (
        <div className="mb-5 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Filters</p>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => { setGenres([]); setYear("all"); setStatus("all"); setVideoKind("all"); resetPage(); }}>
              <X className="h-3 w-3" /> Clear all
            </Button>
          </div>
          {category === "AV" && (
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">Video subcategory — kept distinct by design (never merged into Anime)</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["all", "AV", "JAV", "PMV", "HMV", "CREATOR"].map((k) => (
                  <button
                    key={k}
                    onClick={() => { setVideoKind(k); resetPage(); }}
                    className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${videoKind === k ? "bg-[#3DB4F2] text-[#04121E]" : "border border-border bg-background text-muted-foreground hover:text-foreground"}`}
                  >
                    {k === "all" ? "All video" : k === "AV" ? "General AV" : k === "JAV" ? "JAV" : k === "PMV" ? "PMV" : k === "HMV" ? "HMV" : "Indie creators"}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Subcategories come from each metadata source's specialization: StashDB → general AV · JAVStash → JAV · PMV Stash → PMV/HMV · FansDB → independent creators.
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-4">
            <div className="min-w-44">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v); resetPage(); }}>
                <SelectTrigger className="mt-1 h-9 rounded-lg bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="ONGOING">Ongoing</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-32">
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Select value={year} onValueChange={(v) => { setYear(v); resetPage(); }}>
                <SelectTrigger className="mt-1 h-9 rounded-lg bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any year</SelectItem>
                  {(data?.facets?.years ?? []).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-40">
              <Label className="text-xs text-muted-foreground">Sort</Label>
              <Select value={sort} onValueChange={(v) => { setSort(v); resetPage(); }}>
                <SelectTrigger className="mt-1 h-9 rounded-lg bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {data?.facets && (
            <div className="mt-4">
              <Label className="text-xs text-muted-foreground">Genres</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.facets.genres.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => toggleGenre(g.name)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                      genres.includes(g.name)
                        ? "hub-soft hub-text hub-ring"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {g.name} <span className="opacity-60">{g.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* active genre chips */}
      {genres.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {genres.map((g) => (
            <Badge key={g} variant="secondary" className="gap-1 rounded-full bg-[#3DB4F2]/15 text-[#3DB4F2]">
              {g}
              <button onClick={() => toggleGenre(g)} aria-label={`Remove ${g}`}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}

      {/* live discover rails */}
      {category && (discover.isError ? (
        <p className="mb-6 rounded-lg border border-[#EF5B6B]/25 bg-[#EF5B6B]/10 p-2.5 text-xs text-[#FF8B96]">
          Live rails unavailable right now — {(discover.error as Error).message}
        </p>
      ) : discover.isLoading ? (
        <RailSkeleton />
      ) : (discover.data?.rails.length ?? 0) > 0 && (
        <div className="mb-8 space-y-6">
          {discover.data!.rails.map((rail) => (
            <section key={rail.providerId} aria-label={`Live from ${rail.providerName}`}>
              <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">
                <Radio className="h-4 w-4" style={{ color: meta.hub }} />
                Live from {rail.providerName}
              </h2>
              {rail.error ? (
                <p className="flex items-start gap-1.5 rounded-lg border border-[#EF5B6B]/25 bg-[#EF5B6B]/10 p-2.5 text-xs text-[#FF8B96]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span><span className="font-semibold">{rail.providerName} failed:</span> {rail.error}</span>
                </p>
              ) : rail.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">No items returned right now.</p>
              ) : (
                <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
                  {rail.items.map((item) => (
                    <LiveCatalogCard key={item.id} item={item} hub={meta.hub} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ))}

      {/* results */}
      {isLoading ? (
        <GridSkeleton count={18} />
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No titles match</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Try clearing filters, or check the provider catalogs in Extensions for sources not yet imported.
          </p>
        </div>
      ) : (
        <>
          <div className={cn("transition-opacity", isFetching && "opacity-60")}>
            <MediaGrid items={data.items.map(fromDTO)} />
          </div>
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg">
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg">
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Poster card for a live catalog item. There is no slug yet, so clicking the
// card imports it (POST /api/media/import) and then navigates to the unified
// detail page. Already-imported items show a check badge and open the source.
function LiveCatalogCard({ item, hub }: { item: CatalogItem; hub: string }) {
  const qc = useQueryClient();
  const [merged, setMerged] = useState(false);
  const isImported = item.imported || merged;
  const accent = item.accent ?? hub;
  const sub = [item.year, item.format].filter(Boolean).join(" · ");

  const importMut = useMutation({
    mutationFn: () => post<{ slug: string; merged: boolean }>("/api/media/import", { catalogItemId: item.id }),
    onSuccess: (data) => {
      setMerged(true);
      void qc.invalidateQueries({ queryKey: ["discover"] });
      void qc.invalidateQueries({ queryKey: ["browse"] });
      toast.success(data.merged ? "Merged with existing entry" : "Imported to database", {
        description: data.merged
          ? "Duplicate detected — opening the unified title."
          : `${item.title} is now in the unified database.`,
      });
      navigate(`/media/${data.slug}`);
    },
    onError: (e: Error) => toast.error("Import failed", { description: e.message }),
  });

  const open = () => {
    if (importMut.isPending) return;
    if (isImported) {
      // Already in the database — we have no slug here, so send the user to the
      // provider's own page instead of navigating to /media/undefined.
      if (item.externalUrl) window.open(item.externalUrl, "_blank", "noopener");
      return;
    }
    importMut.mutate();
  };

  return (
    <div
      className="poster-card group w-[138px] shrink-0 cursor-pointer select-none snap-start"
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && open()}
      aria-label={isImported ? `${item.title} — imported, open source page` : `Import ${item.title}`}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-xl card-ring bg-[#141B30]"
        style={{ ["--hub" as string]: accent }}
      >
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={`${item.title} cover`}
            loading="lazy"
            className="poster-img h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}

        {/* import loading state */}
        {importMut.isPending && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-black/60 backdrop-blur-[2px]">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-white/90">Importing…</span>
          </div>
        )}

        {/* score badge */}
        {item.score != null && item.score > 0 && (
          <div className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-[#FFBE4A] backdrop-blur-sm">
            <Star className="h-3 w-3 fill-[#FFBE4A]" /> {item.score.toFixed(1)}
          </div>
        )}

        {/* imported check badge */}
        {isImported && (
          <span
            className="absolute bottom-1.5 left-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#3BD47A] text-black shadow"
            aria-label="Imported"
          >
            <Check className="h-3.5 w-3.5" />
          </span>
        )}

        {/* hover overlay */}
        {!isImported && !importMut.isPending && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: accent, color: "#04121E" }}
            >
              <Plus className="h-5 w-5" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <p className="line-clamp-1 text-[12.5px] font-semibold text-foreground/90 group-hover:text-white transition-colors">
          {item.title}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{sub || "\u00A0"}</p>
        {isImported ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#3BD47A]">
            <Check className="h-3 w-3" /> In database
          </span>
        ) : (
          <button
            className="press-scale mt-1 inline-flex items-center gap-1 text-[11px] font-semibold disabled:opacity-60"
            style={{ color: accent }}
            aria-label={`Import ${item.title} into the database`}
            disabled={importMut.isPending}
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            <Plus className="h-3 w-3" /> Import
          </button>
        )}
      </div>
    </div>
  );
}

function RailSkeleton() {
  return (
    <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="w-[138px] shrink-0">
          <div className="yz-skeleton aspect-[2/3] rounded-xl" />
          <div className="yz-skeleton mt-2 h-3 w-4/5 rounded" />
          <div className="yz-skeleton mt-1.5 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
