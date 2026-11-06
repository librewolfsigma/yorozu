"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X, Search, PackageOpen } from "lucide-react";
import { api } from "@/lib/client-api";
import { categoryMeta } from "@/lib/category-meta";
import { MediaGrid, GridSkeleton, fromDTO } from "@/components/media/card";
import type { MediaDTO } from "@/lib/serialize";
import { cn } from "@/lib/utils";
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
    p.set("sort", sort);
    p.set("page", String(page));
    p.set("pageSize", "24");
    return p.toString();
  }, [category, debouncedQ, genres, year, status, sort, page]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["browse", params],
    queryFn: () => api<BrowseResponse>(`/api/media?${params}`),
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
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => { setGenres([]); setYear("all"); setStatus("all"); resetPage(); }}>
              <X className="h-3 w-3" /> Clear all
            </Button>
          </div>
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
