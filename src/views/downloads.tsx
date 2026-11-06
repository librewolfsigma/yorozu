"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download as DownloadIcon, Pause, Play, X, RotateCcw, Trash2, HardDriveDownload } from "lucide-react";
import { api, patch, del } from "@/lib/client-api";
import { useAuth } from "@/components/providers";
import { fmtBytes, timeAgo } from "@/lib/category-meta";
import { navigate } from "@/hooks/use-hash-route";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { MediaDTO } from "@/lib/serialize";

interface DownloadsResponse {
  downloads: {
    id: string; label: string; kind: string; status: string;
    progress: number; speedBps: number; sizeBytes: number;
    createdAt: string; completedAt: string | null; error: string | null;
    media: MediaDTO;
  }[];
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  QUEUED: { label: "Queued", color: "#6C8299" },
  RUNNING: { label: "Downloading", color: "#3DB4F2" },
  PAUSED: { label: "Paused", color: "#FFBE4A" },
  DONE: { label: "Completed", color: "#3BD47A" },
  ERROR: { label: "Error", color: "#EF5B6B" },
  CANCELLED: { label: "Cancelled", color: "#6C8299" },
};

export default function DownloadsView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["downloads"],
    queryFn: () => api<DownloadsResponse>("/api/downloads"),
    enabled: !!user,
    refetchInterval: (query) => {
      const rows = query.state.data?.downloads ?? [];
      return rows.some((r) => r.status === "RUNNING") ? 1500 : 8000;
    },
  });

  const action = useMutation({
    mutationFn: ({ id, act }: { id: string; act: string }) => patch(`/api/downloads/${id}`, { action: act }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["downloads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/downloads/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["downloads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <HardDriveDownload className="h-10 w-10 text-muted-foreground" />
        <p className="mt-4 font-semibold">Download manager</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Queue chapters, scenes and permitted game files for offline use. Sign in to get started.
        </p>
      </div>
    );
  }

  const rows = data?.downloads ?? [];

  return (
    <div className="pb-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF8A4C]/15 text-[#FF8A4C]">
          <DownloadIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl text-white">Downloads</h1>
          <p className="text-[13px] text-muted-foreground">
            {rows.filter((r) => r.status === "RUNNING").length} active · {rows.filter((r) => r.status === "DONE").length} completed
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#FFBE4A]/25 bg-[#FFBE4A]/10 p-3 text-xs text-foreground/80">
        <span className="font-bold text-[#FFBE4A]">About transfers:</span>
        Demo content transfers are simulated (3 MB/s) — the pipeline, pause/resume/retry logic and
        storage accounting are real. Provider-licensed downloads follow each source&apos;s permissions.
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="yz-skeleton h-20 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-semibold">No downloads yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Use the Download button on any title or chapter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((d) => {
            const st = STATUS_STYLE[d.status] ?? STATUS_STYLE.QUEUED;
            const pct = Math.round(d.progress * 100);
            return (
              <div key={d.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => navigate(`/media/${d.media.slug}`)} className="shrink-0">
                    { }
                    <img src={d.media.coverUrl ?? ""} alt="" className="h-14 w-10 rounded-lg object-cover" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13.5px] font-bold">{d.label}</p>
                      <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: `${st.color}1a`, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {fmtBytes(d.sizeBytes)} · {d.kind.toLowerCase()} · {timeAgo(d.createdAt)}
                      {d.status === "RUNNING" && d.speedBps > 0 && ` · ${fmtBytes(d.speedBps)}/s`}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#23324A]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: st.color }} />
                      </div>
                      <span className="w-10 text-right text-[11px] font-bold tabular-nums text-muted-foreground">{pct}%</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {d.status === "RUNNING" && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Pause" onClick={() => action.mutate({ id: d.id, act: "pause" })}>
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {(d.status === "PAUSED" || d.status === "QUEUED") && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Resume" onClick={() => action.mutate({ id: d.id, act: "resume" })}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {(d.status === "ERROR" || d.status === "CANCELLED") && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Retry" onClick={() => action.mutate({ id: d.id, act: "retry" })}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    {d.status !== "DONE" && d.status !== "CANCELLED" && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#EF5B6B]" aria-label="Cancel" onClick={() => action.mutate({ id: d.id, act: "cancel" })}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" aria-label="Remove" onClick={() => remove.mutate(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
