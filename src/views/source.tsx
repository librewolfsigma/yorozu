"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Search, RefreshCw, AlertTriangle, KeyRound } from "lucide-react";
import { api } from "@/lib/client-api";
import { categoryMeta, videoKindLabel } from "@/lib/category-meta";
import { MediaGrid, GridSkeleton, fromDTO } from "@/components/media/card";
import type { WorkDTO } from "@/lib/serialize";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";

interface SourceResponse {
  provider: {
    id: string;
    name: string;
    category: string;
    status: string;
    configRequired: boolean;
    videoKind: string | null;
  };
  items: WorkDTO[];
  error: string | null;
  total: number;
  page: number;
  live: boolean;
}

// Mihon-style source page: every item comes live from the provider —
// popular listings when no query, upstream search otherwise, paginated.
export default function SourceView({ providerId }: { providerId?: string }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [lastProviderId, setLastProviderId] = useState(providerId);

  // Fresh source → fresh search state (the view instance is reused across routes).
  if (lastProviderId !== providerId) {
    setLastProviderId(providerId);
    setQ("");
    setDebouncedQ("");
    setPage(1);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, refetch, isFetching, isError, error } = useQuery({
    queryKey: ["provider-source", providerId, debouncedQ, page],
    queryFn: () =>
      api<SourceResponse>(
        `/api/providers/${providerId}?q=${encodeURIComponent(debouncedQ)}&page=${page}`
      ),
    enabled: !!providerId,
  });

  const meta = data ? categoryMeta(data.provider.category) : categoryMeta("MISC");

  return (
    <div className="pb-6" style={{ ["--hub" as string]: meta.hub }}>
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5 rounded-lg text-muted-foreground" onClick={() => navigate("/extensions")}>
        <ArrowLeft className="h-4 w-4" /> Extensions
      </Button>

      {/* provider header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl hub-soft" style={{ color: meta.hub }}>
          <meta.icon className="h-5.5 w-5.5" />
        </span>
        <div className="flex-1">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl text-white">
            {data?.provider.name ?? "Provider"}
            {data?.provider.videoKind && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 align-middle text-[10px] font-bold text-muted-foreground">
                {videoKindLabel(data.provider.videoKind)}
              </span>
            )}
          </h1>
          <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span
              className={cn("h-2 w-2 rounded-full", data?.provider.status === "ACTIVE" ? "bg-[#3BD47A]" : data?.provider.status === "ERROR" ? "bg-[#EF5B6B]" : "bg-muted")}
              aria-label={data?.provider.status ?? "unknown status"}
            />
            Mihon-style source · {data ? (debouncedQ ? `${data.total} search results` : "popular listings") : "…"} · live, nothing stored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search this source…"
              className="h-9 rounded-lg bg-card pl-8"
              aria-label={`Search ${data?.provider.name ?? "source"}`}
            />
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Refresh" onClick={() => refetch()}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* config warning — honest: required keys are missing */}
      {data?.provider.configRequired && (
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
      {(data?.error || isError) && (
        <p className="mb-5 flex items-start gap-1.5 rounded-lg border border-[#EF5B6B]/25 bg-[#EF5B6B]/10 p-3 text-xs text-[#FF8B96]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {isError ? (error as Error).message : data?.error}
          </span>
        </p>
      )}

      {/* grid */}
      {isLoading ? (
        <GridSkeleton count={12} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Search className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">{debouncedQ ? "No results on this source" : "Nothing to show yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {debouncedQ
              ? "The provider returned no matches for this query."
              : "Enter a query above — this source serves search results on demand."}
          </p>
        </div>
      ) : (
        <div className={cn("transition-opacity", isFetching && "opacity-60")}>
          <MediaGrid items={data!.items.map(fromDTO)} />
        </div>
      )}

      {/* pagination */}
      {(data?.items.length ?? 0) > 0 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg">
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {data?.page ?? page}</span>
          <Button variant="outline" size="sm" disabled={(data?.items.length ?? 0) === 0} onClick={() => setPage((p) => p + 1)} className="rounded-lg">
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
