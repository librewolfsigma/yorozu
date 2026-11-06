"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, PackageOpen } from "lucide-react";
import { api } from "@/lib/client-api";
import { MediaGrid, GridSkeleton, fromDTO } from "@/components/media/card";
import { ImportButton } from "@/components/media/import-button";
import { categoryMeta, fmtNumber } from "@/lib/category-meta";
import type { MediaDTO } from "@/lib/serialize";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

interface SearchResponse {
  q: string;
  groups: Record<string, MediaDTO[]>;
  providerResults: {
    id: string; title: string; coverUrl: string | null; category: string;
    format: string | null; year: number | null; score: number | null;
    popularity: number; imported: boolean;
    provider: { id: string; name: string; installed: boolean; status: string };
  }[];
  total: number;
}

export default function SearchView({ query }: { query: URLSearchParams }) {
  const q = query.get("q") ?? "";
  const [tab, setTab] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
  });

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Search className="h-10 w-10 text-muted-foreground" />
        <p className="mt-4 font-semibold">Type something to search</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Global search covers the unified database and every installed provider catalog.
        </p>
      </div>
    );
  }

  const groups = data?.groups ?? {};
  const totalUnified = Object.values(groups).reduce((a, b) => a + b.length, 0);

  return (
    <div className="pb-6">
      <h1 className="font-display text-3xl text-white">
        Results for <span className="text-[#3DB4F2]">“{q}”</span>
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {isLoading ? "Searching…" : `${totalUnified} unified titles · ${data?.providerResults.length ?? 0} provider results`}
      </p>

      {isLoading ? (
        <div className="mt-6"><GridSkeleton count={12} /></div>
      ) : (
        <>
          <Tabs value={tab} onValueChange={setTab} className="mt-5">
            <TabsList className="flex-wrap gap-1 rounded-xl bg-card">
              <TabsTrigger value="ALL" className="rounded-lg">All ({totalUnified})</TabsTrigger>
              {Object.keys(groups).map((k) => (
                <TabsTrigger key={k} value={k} className="rounded-lg">
                  {categoryMeta(k).label} ({groups[k].length})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {Object.keys(groups).filter((k) => tab === "ALL" || tab === k).map((k) => (
            <section key={k} className="mt-7">
              <h2 className="mb-3 text-[15px] font-bold text-white">
                {categoryMeta(k).label} <span className="text-muted-foreground">({groups[k].length})</span>
              </h2>
              <MediaGrid items={groups[k].map(fromDTO)} />
            </section>
          ))}

          {totalUnified === 0 && (
            <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border py-14 text-center">
              <PackageOpen className="h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-semibold">No unified results</p>
              <p className="mt-1 text-sm text-muted-foreground">Check provider results below — you can import those.</p>
            </div>
          )}

          {data && data.providerResults.length > 0 && (
            <section className="mt-9">
              <h2 className="mb-1 text-[15px] font-bold text-white">Provider catalog results</h2>
              <p className="mb-3 text-[13px] text-muted-foreground">
                Found in provider sources but not yet merged into the unified database. Import to add them.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.providerResults.map((r) => {
                  const meta = categoryMeta(r.category);
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors",
                        !r.provider.installed && "opacity-70"
                      )}
                    >
                      { }
                      <img src={r.coverUrl ?? ""} alt="" className="h-28 w-[74px] shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13.5px] font-bold leading-snug">{r.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          <span style={{ color: meta.hub }} className="font-semibold">{r.provider.name}</span>
                          {r.year ? <> · {r.year}</> : null}
                          {r.format ? <> · {r.format}</> : null}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">★ {r.score?.toFixed(1) ?? "—"} · {fmtNumber(r.popularity)} adds</p>
                        <div className="mt-2">
                          {r.provider.installed ? (
                            <ImportButton catalogItemId={r.id} imported={r.imported} />
                          ) : (
                            <a href="#/extensions" className="text-xs font-semibold text-[#FFBE4A] underline-offset-2 hover:underline">
                              Install {r.provider.name} first →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
