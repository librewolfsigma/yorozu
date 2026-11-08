"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Database, BarChart3, Search, Puzzle, ExternalLink, AlertTriangle } from "lucide-react";
import { api } from "@/lib/client-api";
import { categoryMeta, fmtNumber, timeAgo } from "@/lib/category-meta";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkDTO } from "@/lib/serialize";

// Backed by the live /api/databases route (client-first — nothing is stored):
//  - databases: the live Wotaku metadata-database directory (WorkDTO entries)
//  - stats: installed-provider counts + health (the only "catalog" Yozora owns)

type DatabaseEntry = WorkDTO;

interface StatsData {
  byCategory: { category: string; count: number }[];
  totals: { providers: number; healthy: number; degraded: number };
  providersHealth: ProviderHealthRow[];
}
interface ProviderHealthRow {
  id: string; name: string; category: string;
  status: string; lastCheckedAt: string | null; lastError: string | null;
}

function statusDot(status: string): string {
  return status === "ACTIVE" ? "bg-[#3BD47A]" : status === "ERROR" ? "bg-[#EF5B6B]" : status === "UNCONFIGURED" ? "bg-[#FFBE4A]" : "bg-muted-foreground/40";
}
function statusBadge(status: string): string {
  return status === "ACTIVE"
    ? "bg-[#3BD47A]/15 text-[#3BD47A]"
    : status === "ERROR"
      ? "bg-[#EF5B6B]/15 text-[#FF8B96]"
      : status === "UNCONFIGURED"
        ? "bg-[#FFBE4A]/15 text-[#FFBE4A]"
        : "bg-muted text-muted-foreground";
}

export default function DatabasesView() {
  const [tab, setTab] = useState("databases");
  const [q, setQ] = useState("");

  const { data: dbs, isLoading: dbsLoading } = useQuery({
    queryKey: ["databases", "databases", q],
    queryFn: () => api<{ databases: DatabaseEntry[] }>(`/api/databases?type=databases&q=${encodeURIComponent(q)}`),
    enabled: tab === "databases",
  });
  const { data: stats } = useQuery({
    queryKey: ["databases", "stats"],
    queryFn: () => api<StatsData>("/api/databases?type=stats"),
    enabled: tab === "stats" || tab === "providers",
  });

  return (
    <div className="pb-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C8CFF]/15 text-[#7C8CFF]">
          <Database className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-3xl text-white">Databases</h1>
          <p className="text-[13px] text-muted-foreground">Live metadata-database directory and installed-provider health</p>
        </div>
        {tab === "databases" && (
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="h-9 rounded-lg bg-card pl-8" aria-label="Filter directory" />
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap gap-1 rounded-xl bg-card">
          <TabsTrigger value="databases" className="gap-1.5 rounded-lg"><Database className="h-3.5 w-3.5" /> Databases</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5 rounded-lg"><BarChart3 className="h-3.5 w-3.5" /> Stats</TabsTrigger>
          <TabsTrigger value="providers" className="gap-1.5 rounded-lg"><Puzzle className="h-3.5 w-3.5" /> Providers</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* databases — live directory, external links only */}
      {tab === "databases" && (
        <div className="mt-6">
          {dbsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="yz-skeleton h-36 rounded-xl" />)}
            </div>
          ) : (dbs?.databases?.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              {dbs ? "No databases match your search." : "Loading the database directory…"}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dbs!.databases.map((d) => {
                const accent = d.accent || "#7C8CFF";
                const meta = categoryMeta(d.category);
                return (
                  <div key={d.ref} className="flex flex-col rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] font-bold leading-snug">{d.title}</p>
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                        title={`Listed by the ${d.providerName} live directory`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.hub }} />
                        {d.providerName}
                      </span>
                    </div>
                    {d.description && (
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{d.description}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      {d.externalUrl ? (
                        <a
                          href={d.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          aria-label={`Open ${d.title} (opens in a new tab)`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-transform hover:scale-[1.04]"
                          style={{ background: `${accent}1a`, color: accent }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">No public URL</span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {d.format ?? meta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* stats — provider counts + health (no media/chapters/pages: those tables no longer exist) */}
      {tab === "stats" && (stats ? (
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Providers", stats.totals.providers],
              ["Healthy", stats.totals.healthy],
              ["Degraded", stats.totals.degraded],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="font-display text-2xl text-white">{fmtNumber(Number(value))}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Installed providers by category</h3>
            {stats.byCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No providers installed yet.</p>
            ) : (
              <div className="space-y-2">
                {stats.byCategory.slice().sort((a, b) => b.count - a.count).map((c) => {
                  const meta = categoryMeta(c.category);
                  const max = Math.max(...stats.byCategory.map((x) => x.count), 1);
                  return (
                    <div key={c.category} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-semibold" style={{ color: meta.hub }}>{meta.label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, background: meta.hub }} />
                      </div>
                      <span className="w-8 text-right text-xs font-bold tabular-nums">{c.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <ProviderHealth rows={stats.providersHealth} />
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Loading statistics…
        </p>
      ))}

      {/* providers */}
      {tab === "providers" && (stats ? <ProviderHealth rows={stats.providersHealth} /> : (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Loading statistics…
        </p>
      ))}
    </div>
  );
}

function ProviderHealth({ rows }: { rows: ProviderHealthRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
        No providers installed yet — add one from the{" "}
        <a href="#/extensions" className="font-semibold text-primary hover:underline">Extensions page</a>.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="min-w-[560px]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Provider health</h3>
          <a href="#/extensions" className="text-xs font-semibold text-primary hover:underline">Manage in Extensions</a>
        </div>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-semibold">Provider</th>
              <th scope="col" className="px-4 py-2 font-semibold">Category</th>
              <th scope="col" className="px-4 py-2 font-semibold">Status</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Last checked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const meta = categoryMeta(p.category);
              return (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                  <td className="px-4 py-2.5" style={{ color: meta.hub }}>{meta.label}</td>
                  <td className="px-4 py-2.5">
                    {p.status === "ERROR" && p.lastError ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${p.name} is in error state. Last error: ${p.lastError}`}
                            className="inline-flex cursor-help items-center gap-1.5 rounded-full bg-[#EF5B6B]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF8B96] outline-none"
                          >
                            <AlertTriangle className="h-3 w-3" /> ERROR
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-72 border border-border bg-141519">
                          <p className="font-bold">Last error</p>
                          <p className="mt-0.5 text-foreground/80">{p.lastError}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold", statusBadge(p.status))}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status))} />
                        {p.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {p.lastCheckedAt ? timeAgo(p.lastCheckedAt) : "never"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
