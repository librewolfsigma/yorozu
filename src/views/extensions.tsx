"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Puzzle, RefreshCw, Power, Trash2, Settings2, Download, CheckCircle2,
  XCircle, Loader2, Store, ChevronRight, AlertTriangle,
} from "lucide-react";
import { api, post } from "@/lib/client-api";
import { useAuth } from "@/components/providers";
import { categoryMeta } from "@/lib/category-meta";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { timeAgo } from "@/lib/category-meta";

interface ProviderRow {
  id: string; name: string; category: string; description: string;
  version: string; author: string | null; homepage: string | null;
  capabilities: string[]; configSchema: { key: string; label: string; type: string; required?: boolean; options?: string[]; help?: string }[];
  config: Record<string, unknown>; status: string; lastError: string | null;
  lastCheckedAt: string | null; installedAt: string; itemCount: number;
  live: boolean; integration: string | null;
}
interface RepositoryRow {
  id: string; name: string; category: string; description: string;
  version: string; author: string; homepage: string;
  capabilities: string[]; configSchema: unknown[];
  live: boolean; integration: string | null;
}

export default function ExtensionsView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [healthBusy, setHealthBusy] = useState<string | null>(null);
  const [configFor, setConfigFor] = useState<ProviderRow | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { data, isLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api<{ installed: ProviderRow[]; repository: RepositoryRow[] }>("/api/providers"),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["providers"] });
    void qc.invalidateQueries({ queryKey: ["home"] });
  };

  const install = useMutation({
    mutationFn: (id: string) => post("/api/providers", { action: "install", providerId: id }),
    onSuccess: () => {
      invalidate();
      toast.success("Provider installed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const uninstall = useMutation({
    mutationFn: (id: string) => post("/api/providers", { action: "uninstall", providerId: id }),
    onSuccess: () => {
      invalidate();
      toast.success("Provider uninstalled (unified database entries kept)");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (id: string) => post("/api/providers", { action: "toggle", providerId: id }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const configure = useMutation({
    mutationFn: () => post("/api/providers", { action: "configure", providerId: configFor!.id, config: configValues }),
    onSuccess: () => {
      invalidate();
      setConfigFor(null);
      toast.success("Configuration saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runHealth = async (id: string) => {
    setHealthBusy(id);
    try {
      const res = await post<{ status: string; lastError: string | null }>("/api/providers", { action: "health", providerId: id });
      if (res.status === "ACTIVE") toast.success(`Health check passed: ${id}`);
      else toast.warning(`Health check: ${res.status}`, { description: res.lastError ?? undefined });
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHealthBusy(null);
    }
  };

  const runAllHealth = async () => {
    const ids = (data?.installed ?? []).map((p) => p.id);
    for (const id of ids) {
      await runHealth(id);
    }
  };

  return (
    <div className="pb-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3BD47A]/15 text-[#3BD47A]">
          <Puzzle className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-3xl text-white">Extensions</h1>
          <p className="text-[13px] text-muted-foreground">
            Mihon-style provider system: {data?.installed.length ?? 0} installed · {data?.repository.length ?? 0} available in repository
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-lg border-border" onClick={runAllHealth} disabled={healthBusy !== null}>
          {healthBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check all health
        </Button>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#3DB4F2]/25 bg-[#3DB4F2]/10 p-3 text-xs leading-relaxed text-foreground/85">
        <span className="font-bold text-[#3DB4F2]">How it works:</span>
        Every installed provider is a live adapter hitting its upstream API or site — health checks are real requests and
        any error shown is the provider&apos;s own response. One broken provider never breaks the platform — failed checks are
        isolated, and unified database entries survive uninstalls. Catalog items appear under
        <button className="mx-1 underline" onClick={() => navigate("/browse/ANIME")}>Browse</button>
        only after import (duplicate-safe).
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="yz-skeleton h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* installed */}
          <h2 className="mb-3 text-[15px] font-bold">Installed providers</h2>
          <div className="space-y-3">
            {(data?.installed ?? []).map((p) => {
              const meta = categoryMeta(p.category);
              return (
                <div key={p.id} className="rounded-xl border border-border bg-card p-4" style={{ ["--hub" as string]: meta.hub }}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hub-soft" style={{ color: meta.hub }}>
                      <meta.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-bold">{p.name}</p>
                        {p.live && p.status === "ACTIVE" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#3BD47A]/15 px-2 py-0.5 text-[10px] font-bold text-[#3BD47A]">
                            <span className="yz-pulse-dot h-1.5 w-1.5 rounded-full bg-[#3BD47A]" /> Live
                          </span>
                        )}
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${meta.hub}1a`, color: meta.hub }}>
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">v{p.version} · by {p.author ?? "unknown"}</span>
                        <StatusChip status={p.status} lastError={p.lastError} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{p.description}</p>
                      {p.integration && (
                        <div className="mt-1.5">
                          <p className={cn("text-[11.5px] leading-relaxed text-muted-foreground/80", !expanded.has(p.id) && "line-clamp-1")}>
                            <span className="font-semibold text-muted-foreground">Integration:</span> {p.integration}
                          </p>
                          <button
                            className="mt-0.5 text-[11px] font-semibold text-muted-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
                            aria-expanded={expanded.has(p.id)}
                            onClick={() => toggleExpanded(p.id)}
                          >
                            {expanded.has(p.id) ? "Show less" : "Show more"}
                          </button>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {p.capabilities.map((c) => (
                          <Badge key={c} variant="secondary" className="rounded-md bg-muted font-mono text-[10px]">{c}</Badge>
                        ))}
                        <Badge variant="secondary" className="rounded-md bg-muted text-[10px]">{p.itemCount} catalog items</Badge>
                      </div>
                      {p.lastError && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-[#EF5B6B]/25 bg-[#EF5B6B]/10 p-2 text-xs text-[#FF8B96]">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {p.lastError}
                        </p>
                      )}
                      <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                        Last checked: {p.lastCheckedAt ? timeAgo(p.lastCheckedAt) : "never"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button variant="outline" size="sm" className="h-8 gap-1 rounded-lg border-border text-xs" onClick={() => navigate(`/source/${p.id}`)}>
                        Catalog <ChevronRight className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Health check" title="Health check" onClick={() => runHealth(p.id)} disabled={healthBusy === p.id}>
                        {healthBusy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      {p.configSchema.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          aria-label="Configure"
                          title="Configure"
                          onClick={() => {
                            setConfigValues(Object.fromEntries(Object.entries(p.config ?? {}).map(([k, v]) => [k, String(v)])));
                            setConfigFor(p);
                          }}
                        >
                          <Settings2 className={cn("h-4 w-4", p.lastError && "text-[#FFBE4A]")} />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={p.status === "DISABLED" ? "Enable" : "Disable"} title={p.status === "DISABLED" ? "Enable" : "Disable"} onClick={() => toggle.mutate(p.id)}>
                        <Power className={cn("h-4 w-4", p.status === "DISABLED" && "text-[#EF5B6B]")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#EF5B6B]"
                        aria-label="Uninstall"
                        title="Uninstall"
                        onClick={() => {
                          if (confirm(`Uninstall ${p.name}? Unified database entries are kept.`)) uninstall.mutate(p.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* repository */}
          <h2 className="mb-3 mt-8 flex items-center gap-2 text-[15px] font-bold">
            <Store className="h-4 w-4 text-muted-foreground" /> Repository — available to install
          </h2>
          {(data?.repository.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Everything is installed.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(data?.repository ?? []).map((p) => {
                const meta = categoryMeta(p.category);
                return (
                  <div key={p.id} className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-card/50 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted" style={{ color: meta.hub }}>
                      <meta.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold">
                        {p.name} <span className="ml-1 text-[11px] font-normal text-muted-foreground">v{p.version} · {meta.label}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{p.description}</p>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 shrink-0 gap-1 rounded-lg border-0 text-xs text-[#04121E]"
                      style={{ background: meta.hub }}
                      onClick={() => install.mutate(p.id)}
                      disabled={install.isPending}
                    >
                      {install.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Install
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* config dialog */}
      <Dialog open={!!configFor} onOpenChange={(v) => !v && setConfigFor(null)}>
        <DialogContent className="max-w-sm rounded-2xl border-border bg-card" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Configure {configFor?.name}</DialogTitle>
            {configFor?.integration && (
              <p className="rounded-lg border border-border bg-background/50 p-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground/80">How this integration works:</span> {configFor.integration}
              </p>
            )}
            {configFor?.lastError && (
              <p className="flex items-start gap-1.5 rounded-lg border border-[#EF5B6B]/25 bg-[#EF5B6B]/10 p-2 text-xs text-[#FF8B96]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {configFor.lastError}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-3">
            {(configFor?.configSchema ?? []).map((f) => (
              <div key={f.key}>
                <Label>
                  {f.label}
                  {f.required && <span className="ml-1 text-[#EF5B6B]">*</span>}
                </Label>
                {f.type === "select" && f.options ? (
                  <Select value={configValues[f.key] ?? ""} onValueChange={(v) => setConfigValues((c) => ({ ...c, [f.key]: v }))}>
                    <SelectTrigger className="mt-1 rounded-lg bg-background"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={configValues[f.key] ?? ""}
                    onChange={(e) => setConfigValues((c) => ({ ...c, [f.key]: e.target.value }))}
                    className="mt-1 rounded-lg bg-background"
                  />
                )}
                {f.help && <p className="mt-1 text-[11px] text-muted-foreground">{f.help}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfigFor(null)}>Cancel</Button>
            <Button className="rounded-lg border-0 text-[#04121E]" style={{ background: "#3BD47A" }} disabled={configure.isPending} onClick={() => configure.mutate()}>
              {configure.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusChip({ status, lastError }: { status: string; lastError: string | null }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#3BD47A]/15 px-2 py-0.5 text-[10px] font-bold text-[#3BD47A]">
        <CheckCircle2 className="h-3 w-3" /> Active
      </span>
    );
  }
  if (status === "ERROR") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EF5B6B]/15 px-2 py-0.5 text-[10px] font-bold text-[#EF5B6B]">
        <XCircle className="h-3 w-3" /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      <XCircle className="h-3 w-3" /> Disabled
    </span>
  );
}
