"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileCode2, Download, Trash2, ShieldCheck, Loader2, Power, ExternalLink,
} from "lucide-react";
import { api, post } from "@/lib/client-api";
import { useAuth } from "@/components/providers";
import { timeAgo } from "@/lib/category-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { WorkDTO } from "@/lib/serialize";

type ScriptEntry = WorkDTO & { install: { enabled: boolean; installedAt: string } | null };

interface ScriptsResponse {
  scripts: ScriptEntry[];
}

export default function ScriptsView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["scripts"],
    queryFn: () => api<ScriptsResponse>("/api/scripts"),
  });

  const mutate = useMutation({
    mutationFn: ({ script, action }: { script: ScriptEntry; action: "install" | "uninstall" | "toggle" }) =>
      post("/api/scripts", { provider: script.provider, externalId: script.externalId, title: script.title, action }),
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
            {installed.length} tracked · {scripts.length} in directory
          </p>
        </div>
      </div>

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#3BD47A]/25 bg-[#3BD47A]/10 p-3.5">
        <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#3BD47A]" />
        <p className="text-xs leading-relaxed text-foreground/85">
          <span className="font-bold text-[#3BD47A]">Sandbox policy:</span> Yozora never executes
          third-party code. Entries are fetched live from the Wotaku directory and carry real names,
          descriptions and official URLs. Installing records a tracked bookmark so you can audit what
          you use — the script itself runs in your own userscript manager, outside this platform.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="yz-skeleton h-28 rounded-xl" />)}
        </div>
      ) : scripts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-semibold">Directory unavailable</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            The live script directory could not be reached right now. Nothing is cached locally — try again later.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {scripts.map((s) => (
            <div
              key={s.ref}
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
                    <span className="text-[11px] text-muted-foreground">from {s.providerName}</span>
                    {s.externalUrl && (
                      <a
                        href={s.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3BD47A] hover:underline"
                        aria-label={`Open the official page for ${s.title} (opens in a new tab)`}
                      >
                        <ExternalLink className="h-3 w-3" /> Official page
                      </a>
                    )}
                  </div>
                  {s.description && (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{s.description}</p>
                  )}
                  {s.install && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                      Tracked install {timeAgo(s.install.installedAt)} · bookmark only, nothing is executed here
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {s.install ? (
                    <>
                      <Switch
                        checked={s.install.enabled}
                        onCheckedChange={() => mutate.mutate({ script: s, action: "toggle" })}
                        aria-label={s.install.enabled ? "Disable tracked install" : "Enable tracked install"}
                      />
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {s.install.enabled ? "Enabled" : "Disabled"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 rounded-lg text-xs text-[#EF5B6B] hover:bg-[#EF5B6B]/10 hover:text-[#EF5B6B]"
                        onClick={() => mutate.mutate({ script: s, action: "uninstall" })}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Untrack
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 gap-1 rounded-lg border-0 text-xs text-[#04121E]"
                      style={{ background: "#3BD47A" }}
                      disabled={mutate.isPending}
                      onClick={() => {
                        if (!user) {
                          toast.error("Sign in first", { description: "Use the demo login from the header." });
                          return;
                        }
                        mutate.mutate({ script: s, action: "install" });
                      }}
                    >
                      {mutate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Track install
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
