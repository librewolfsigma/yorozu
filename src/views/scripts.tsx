"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  FileCode2, Download, Trash2, ShieldCheck, Loader2, ShieldAlert, Power,
} from "lucide-react";
import { api, post } from "@/lib/client-api";
import { useAuth } from "@/components/providers";
import { fmtNumber, timeAgo } from "@/lib/category-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ScriptsResponse {
  scripts: {
    id: string; title: string; description: string | null; format: string | null;
    status: string | null; popularity: number;
    creator: string | null; imported: boolean;
    extra: { version?: string; sourceUrl?: string; installs?: number; permissions?: { domain: string; reason: string }[] };
    provider: { id: string; name: string; installed: boolean; status: string };
    install: { enabled: boolean; installedAt: string } | null;
  }[];
}

export default function ScriptsView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["scripts"],
    queryFn: () => api<ScriptsResponse>("/api/scripts"),
  });

  const mutate = useMutation({
    mutationFn: ({ scriptId, action }: { scriptId: string; action: string }) =>
      post("/api/scripts", { scriptId, action }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["scripts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const scripts = data?.scripts ?? [];
  const installed = scripts.filter((s) => s.install);

  return (
    <div className="pb-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3BD47A]/15 text-[#3BD47A]">
          <FileCode2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl text-white">Scripts & Extensions</h1>
          <p className="text-[13px] text-muted-foreground">
            {installed.length} installed · {scripts.length} in catalog
          </p>
        </div>
      </div>

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#3BD47A]/25 bg-[#3BD47A]/10 p-3.5">
        <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#3BD47A]" />
        <p className="text-xs leading-relaxed text-foreground/85">
          <span className="font-bold text-[#3BD47A]">Sandbox policy:</span> Yozora never executes
          third-party code. Every script is tracked as metadata with an explicit, per-domain
          permission manifest. Installing records the grant so you can audit it; nothing runs
          inside the platform.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="yz-skeleton h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {scripts.map((s) => (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border bg-card p-4",
                s.install ? "border-[#3BD47A]/30" : "border-border"
              )}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-bold">{s.title}</p>
                    <Badge variant="secondary" className="rounded-md bg-muted text-[10px]">{s.format ?? "Userscript"}</Badge>
                    {s.extra.version && <span className="text-[11px] text-muted-foreground">v{s.extra.version}</span>}
                    <span className="text-[11px] text-muted-foreground">
                      {fmtNumber(s.extra.installs ?? 0)} installs · by {s.creator ?? s.provider.name}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{s.description}</p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(s.extra.permissions ?? []).map((p) => (
                      <span key={p.domain} className="inline-flex items-center gap-1 rounded-md bg-[#FFBE4A]/12 px-2 py-0.5 text-[10.5px] font-semibold text-[#FFBE4A]" title={p.reason}>
                        <ShieldAlert className="h-3 w-3" /> {p.domain}
                      </span>
                    ))}
                  </div>
                  {s.install && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                      Installed {timeAgo(s.install.installedAt)} · granted: {(s.extra.permissions ?? []).map((p) => p.domain).join(", ") || "none"}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {s.install ? (
                    <>
                      <Switch
                        checked={s.install.enabled}
                        onCheckedChange={() => mutate.mutate({ scriptId: s.id, action: "toggle" })}
                        aria-label={s.install.enabled ? "Disable script" : "Enable script"}
                      />
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {s.install.enabled ? "Enabled" : "Disabled"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 rounded-lg text-xs text-[#EF5B6B] hover:bg-[#EF5B6B]/10 hover:text-[#EF5B6B]"
                        onClick={() => mutate.mutate({ scriptId: s.id, action: "uninstall" })}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Uninstall
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 gap-1 rounded-lg border-0 text-xs text-[#04121E]"
                      style={{ background: "#3BD47A" }}
                      disabled={mutate.isPending || !s.provider.installed}
                      onClick={() => {
                        if (!user) {
                          toast.error("Sign in first", { description: "Use the demo login from the header." });
                          return;
                        }
                        mutate.mutate({ scriptId: s.id, action: "install" });
                      }}
                    >
                      {mutate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      {s.provider.installed ? "Install" : "Provider not installed"}
                    </Button>
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
