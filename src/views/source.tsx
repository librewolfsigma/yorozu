"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Search, RefreshCw } from "lucide-react";
import { api } from "@/lib/client-api";
import { categoryMeta } from "@/lib/category-meta";
import { ImportButton } from "@/components/media/import-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";

interface CatalogResponse {
  provider: { id: string; name: string; category: string; status: string };
  items: {
    id: string; title: string; coverUrl: string | null; description: string | null;
    format: string | null; year: number | null; score: number | null;
    popularity: number; genres: string[]; imported: boolean; externalUrl: string | null;
  }[];
  total: number;
}

export default function SourceView({ providerId }: { providerId?: string }) {
  const [q, setQ] = useState("");
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["provider-catalog", providerId, q],
    queryFn: () => api<CatalogResponse>(`/api/providers/${providerId}?q=${encodeURIComponent(q)}&pageSize=48`),
    enabled: !!providerId,
  });

  const meta = data ? categoryMeta(data.provider.category) : categoryMeta("MISC");

  return (
    <div className="pb-6" style={{ ["--hub" as string]: meta.hub }}>
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5 rounded-lg text-muted-foreground" onClick={() => navigate("/extensions")}>
        <ArrowLeft className="h-4 w-4" /> Extensions
      </Button>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl hub-soft" style={{ color: meta.hub }}>
          <meta.icon className="h-5.5 w-5.5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-3xl text-white">{data?.provider.name ?? "Provider"} <span className="text-base text-muted-foreground">catalog</span></h1>
          <p className="text-[13px] text-muted-foreground">
            Mihon-style source page — {data?.total ?? 0} items · status: {data?.provider.status ?? "…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this source…" className="h-9 rounded-lg bg-card pl-8" />
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Refresh" onClick={() => refetch()}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="yz-skeleton h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((item) => (
            <div key={item.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
              { }
              <img src={item.coverUrl ?? ""} alt="" className="h-32 w-[84px] shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13.5px] font-bold leading-snug">{item.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {item.year ?? "—"} · {item.format ?? meta.label} · ★ {item.score?.toFixed(1) ?? "—"}
                </p>
                {item.description && <p className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground">{item.description}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <ImportButton catalogItemId={item.id} imported={item.imported} />
                  {item.externalUrl && (
                    <a href={item.externalUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                      source page ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
