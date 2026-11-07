"use client";

// Sources — the Mihon-style source directory. Yozora's primary browsing
// surface is PROVIDER-based: pick a source, browse its catalog (infinite
// scroll, live). Categories still exist as aggregate feeds (Browse), but
// this screen is where every installed source is reachable in one click,
// with honest per-source health (upstream status + missing-key warnings).

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Puzzle, ChevronRight, KeyRound, RefreshCw, Play, BookOpen, Image as ImageIcon, ExternalLink } from "lucide-react";
import { api } from "@/lib/client-api";
import { CATEGORIES, categoryMeta, videoKindLabel } from "@/lib/category-meta";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ProviderDTO {
  id: string;
  name: string;
  category: string;
  videoKind: string | null;
  description: string;
  status: string;
  installed: boolean;
  integration: string | null;
  configRequired: boolean;
  capabilities: string[];
  availability: { watch: boolean; read: boolean; view: boolean };
}

export default function SourcesView({ embedded }: { embedded?: boolean } | undefined) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["providers-installed"],
    queryFn: () => api<{ installed: ProviderDTO[] }>("/api/providers"),
  });
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const installed = (data?.installed ?? []).filter((p) => p.installed);
    const query = q.trim().toLowerCase();
    const matches = query
      ? installed.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query) ||
            (p.videoKind ?? "").toLowerCase().includes(query),
        )
      : installed;
    const byCat = new Map<string, ProviderDTO[]>();
    for (const p of matches) {
      const list = byCat.get(p.category) ?? [];
      list.push(p);
      byCat.set(p.category, list);
    }
    // Order groups by the canonical taxonomy order; sort sources by name.
    const order = CATEGORIES.map((c) => c.key);
    return [...byCat.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([cat, list]) => [cat, list.sort((a, b) => a.name.localeCompare(b.name))] as const);
  }, [data, q]);

  const total = data?.installed.filter((p) => p.installed).length ?? 0;
  const degraded = (data?.installed ?? []).filter((p) => p.installed && p.status === "ERROR" && !p.configRequired).length;

  return (
    <div className="pb-6">
      {!embedded && (
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl hub-soft" style={{ color: "#3DB4F2" }}>
          <Puzzle className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-3xl text-white">Sources</h1>
          <p className="text-[13px] text-muted-foreground">
            {total} installed providers, grouped by category — tap one to browse its catalog live (Mihon-style). Nothing is stored locally.
          </p>
        </div>
        <div className="relative w-44 sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter sources…"
            className="h-9 rounded-lg bg-card pl-8"
            aria-label="Filter installed sources"
          />
        </div>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Refresh health" onClick={() => void refetch()}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>
      )}
      {embedded && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-[12.5px] text-muted-foreground">
            {total} installed — tap a source to browse it live.
          </p>
          <div className="flex items-center gap-1.5">
            <div className="relative w-36 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter sources…"
                className="h-8 rounded-lg bg-card pl-8 text-[13px]"
                aria-label="Filter installed sources"
              />
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Refresh health" onClick={() => void refetch()}>
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
      )}

      {degraded > 0 && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg border border-[#FFBE4A]/30 bg-[#FFBE4A]/10 px-3 py-2 text-xs text-foreground/85">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-[#FFBE4A]" />
          {degraded} source{degraded === 1 ? "" : "s"} upstream-degraded right now — their listings will show honest errors instead of fake data.
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="yz-skeleton h-[74px] rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Puzzle className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No sources match “{q}”</p>
          <button onClick={() => setQ("")} className="mt-3 text-[13px] font-bold text-[#3DB4F2] hover:underline">
            Clear filter
          </button>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map(([cat, list]) => {
            const meta = categoryMeta(cat);
            const Icon = meta.icon;
            return (
              <section key={cat} style={{ ["--hub" as string]: meta.hub }}>
                <div className="mb-2.5 flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: meta.hub }} />
                  <h2 className="text-[15px] font-bold text-white">{meta.label}</h2>
                  <span className="text-[11px] font-semibold text-muted-foreground">· {list.length}</span>
                  <a
                    href={`#/browse/${cat}`}
                    className="ml-auto flex items-center gap-0.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Aggregate feed <ChevronRight className="h-3 w-3" />
                  </a>
                </div>
                <div className="space-y-2">
                  {list.map((p) => (
                    <SourceCard key={p.id} p={p} accent={meta.hub} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className={cn("text-center text-[12.5px] text-muted-foreground", embedded && "mt-6 text-left")}>
        Install or configure more sources in{" "}
        <a href="#/extensions" className="font-bold text-[#3DB4F2] hover:underline">
          Extensions
        </a>{" "}
        — including synced upstream extension repositories.
      </p>
    </div>
  );
}

function SourceCard({ p, accent }: { p: ProviderDTO; accent: string }) {
  const meta = categoryMeta(p.category);
  return (
    <button
      onClick={() => navigate(`/source/${p.id}`)}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg press-scale"
      aria-label={`Open source ${p.name}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hub-soft" style={{ color: accent }}>
        <meta.icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13.5px] font-bold text-white">{p.name}</span>
          {p.videoKind && (
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
              {videoKindLabel(p.videoKind)}
            </span>
          )}
          <span className="rounded-full bg-[#EF5B6B]/15 px-1.5 py-0.5 text-[9.5px] font-bold text-[#FF8B96]">18+</span>
          {p.availability.watch && <Play className="h-3 w-3 text-[#3BD47A]" aria-label="watchable" />}
          {p.availability.read && <BookOpen className="h-3 w-3 text-[#3ED6B0]" aria-label="readable" />}
          {p.availability.view && <ImageIcon className="h-3 w-3 text-[#AE8BFF]" aria-label="viewable" />}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              p.configRequired || p.status === "UNCONFIGURED" ? "bg-[#FFBE4A]" : p.status === "ERROR" ? "bg-[#EF5B6B]" : p.status === "ACTIVE" ? "bg-[#3BD47A]" : "bg-muted-foreground/40",
            )}
          />
          {p.configRequired || p.status === "UNCONFIGURED" ? "needs your API key" : p.status === "ERROR" ? "upstream error" : p.status === "ACTIVE" ? "live" : "disabled"}
          <span className="opacity-60">· {meta.label}</span>
        </span>
      </span>
      {p.configRequired || p.status === "UNCONFIGURED" ? (
        <KeyRound className="h-3.5 w-3.5 shrink-0 text-[#FFBE4A]" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-50 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}
