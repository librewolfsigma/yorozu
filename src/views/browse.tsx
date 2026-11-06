"use client";

import { useQuery } from "@tanstack/react-query";
import { PackageOpen, AlertTriangle, Puzzle } from "lucide-react";
import { api } from "@/lib/client-api";
import { categoryMeta, VIDEO_KINDS, videoKindLabel } from "@/lib/category-meta";
import { MediaCard, GridSkeleton, fromDTO } from "@/components/media/card";
import type { WorkDTO } from "@/lib/serialize";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";

interface DiscoverResponse {
  category: string;
  kind: string | null;
  rails: { providerId: string; providerName: string; videoKind: string | null; items: WorkDTO[]; error: string | null }[];
}

// Live browse: one rail per installed provider in this category, straight from
// the provider's own popular listings. No local database, no facets.
export default function BrowseView({ category, query }: { category?: string; query: URLSearchParams }) {
  const meta = categoryMeta(category ?? "MISC");
  const kind = query.get("kind") ?? "";
  const isAV = (category ?? "").toUpperCase() === "AV";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["discover", category, kind],
    queryFn: () =>
      api<DiscoverResponse>(`/api/discover/${category}${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`),
    enabled: !!category,
  });

  const activeKind = VIDEO_KINDS.find((k) => k.key === kind) ?? VIDEO_KINDS[0];
  const rails = data?.rails ?? [];
  const usableRails = rails.filter((r) => !r.error && r.items.length > 0);
  const allFailed = rails.length > 0 && usableRails.length === 0;

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
            Live from installed providers — nothing is stored locally.
          </p>
        </div>
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

      {/* rails */}
      {isError ? (
        <p className="rounded-lg border border-[#EF5B6B]/25 bg-[#EF5B6B]/10 p-2.5 text-xs text-[#FF8B96]">
          Live rails unavailable right now — {(error as Error).message}
        </p>
      ) : isLoading ? (
        <>
          <RailSkeleton />
          <div className="mt-6"><RailSkeleton /></div>
        </>
      ) : rails.length === 0 ? (
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
      ) : allFailed ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Every source failed for this category</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            The errors below come straight from the providers — check Extensions for health details or try again later.
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {rails.map((rail) => (
            <section key={rail.providerId} aria-label={`Live from ${rail.providerName}`}>
              <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full", rail.error ? "bg-[#EF5B6B]" : "bg-[#3BD47A]")}
                  aria-label={rail.error ? "Source error" : "Source live"}
                />
                {rail.providerName}
                {rail.videoKind && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {videoKindLabel(rail.videoKind)}
                  </span>
                )}
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
                    <MediaCard key={item.ref} media={fromDTO(item)} width={138} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
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
