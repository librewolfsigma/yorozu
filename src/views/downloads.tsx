"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download as DownloadIcon, X, RotateCcw, Trash2, HardDriveDownload, FileDown } from "lucide-react";
import { api, patch, del } from "@/lib/client-api";
import { useAuth } from "@/components/providers";
import { fmtBytes, timeAgo, categoryMeta } from "@/lib/category-meta";
import { navigate } from "@/hooks/use-hash-route";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { MediaDTO } from "@/lib/serialize";

interface DownloadRow {
  id: string;
  label: string;
  kind: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "ERROR";
  progress: number;
  speedBps: number;
  sizeBytes: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  hasFile: boolean;
  createdAt: string;
  media: MediaDTO;
}

interface DownloadsResponse {
  downloads: DownloadRow[];
}

// Real download rows only: each row points at /api/downloads/<id>/file which
// streams the actual provider-hosted bytes with Content-Disposition: attachment.
// There is no simulated progress, pause or resume anywhere.
const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  QUEUED: { label: "Queued", color: "#6C8299" },
  RUNNING: { label: "Transferring", color: "#3DB4F2" },
  DONE: { label: "Saved", color: "#3BD47A" },
  ERROR: { label: "Error", color: "#EF5B6B" },
};

const KIND_LABEL: Record<string, string> = {
  EPISODE: "Episode",
  CHAPTER: "Chapter",
  GALLERY: "Gallery image",
  GAME: "Game",
  SCRIPT: "Script",
};

function SaveFileButton({ id, label, again = false }: { id: string; label: string; again?: boolean }) {
  const fileUrl = `/api/downloads/${id}/file`;
  return (
    <Button asChild size="sm" className="h-8 gap-1.5 rounded-lg border-0 text-[#04121E]" style={{ background: "#3BD47A" }}>
      <a href={fileUrl} download aria-label={again ? `Save ${label} again` : `Save file ${label}`}>
        <FileDown className="h-3.5 w-3.5" />
        {again ? "Save again" : "Save file"}
      </a>
    </Button>
  );
}

function metaLine(d: DownloadRow): string {
  switch (d.status) {
    case "DONE":
      return `${d.sizeBytes > 0 ? `${fmtBytes(d.sizeBytes)} · ` : ""}saved ${d.completedAt ? timeAgo(d.completedAt) : ""}`;
    case "RUNNING":
      return `Transferring to your browser · started ${d.startedAt ? timeAgo(d.startedAt) : timeAgo(d.createdAt)}`;
    case "ERROR":
      return `Failed · ${timeAgo(d.createdAt)}`;
    default:
      return `Waiting · queued ${timeAgo(d.createdAt)}`;
  }
}

export default function DownloadsView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["downloads"],
    queryFn: () => api<DownloadsResponse>("/api/downloads"),
    enabled: !!user,
    refetchInterval: (query) => {
      const rows = query.state.data?.downloads ?? [];
      return rows.some((r) => r.status === "RUNNING" || r.status === "QUEUED") ? 2500 : 10000;
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) => patch(`/api/downloads/${id}`, { action: "cancel" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["downloads"] });
      toast.success("Download cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const retry = useMutation({
    mutationFn: (id: string) => patch(`/api/downloads/${id}`, { action: "retry" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["downloads"] });
      toast.success("Re-queued — open Save file to transfer it again.");
    },
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
          Save real provider-hosted files straight to your browser. Sign in to get started.
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
            {rows.filter((r) => r.status === "QUEUED" || r.status === "RUNNING").length} active · {rows.filter((r) => r.status === "DONE").length} saved
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#FF8A4C]/25 bg-[#FF8A4C]/10 p-3 text-xs leading-relaxed text-foreground/80">
        <span className="shrink-0 font-bold text-[#FF8A4C]">Real transfers:</span>
        <span>
          Every entry here streams the actual file from its provider through <code className="font-mono">/api/downloads/&lt;id&gt;/file</code> with a
          save-to-disk header. Sizes are recorded from the real transfer — there is no simulated progress, and streaming downloads cannot be paused.
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="yz-skeleton h-20 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <HardDriveDownload className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No downloads yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Downloads stream real files from providers straight to your browser. Use the Download button on any
            title, chapter or gallery — saved transfers appear here with their true size.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((d) => {
            const st = STATUS_STYLE[d.status] ?? STATUS_STYLE.QUEUED;
            const kind = KIND_LABEL[d.kind] ?? d.kind.toLowerCase();
            const meta = categoryMeta(d.media.category);
            return (
              <div key={d.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/media/${d.media.slug}`)}
                    className="shrink-0"
                    aria-label={`Open ${d.media.title}`}
                  >
                    {d.media.coverUrl ? (
                      <img src={d.media.coverUrl} alt="" className="h-14 w-10 rounded-lg object-cover card-ring" />
                    ) : (
                      <span className="flex h-14 w-10 items-center justify-center rounded-lg bg-muted" style={{ color: meta.hub }}>
                        <meta.icon className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-[13.5px] font-bold">{d.label}</p>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: `${meta.hub}1a`, color: meta.hub }}
                      >
                        {kind}
                      </span>
                      <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: `${st.color}1a`, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{metaLine(d)}</p>
                    {d.status === "ERROR" && d.error && (
                      <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-[#EF5B6B]/25 bg-[#EF5B6B]/10 p-2 text-xs text-[#FF8B96]">
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {d.error}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {(d.status === "QUEUED" || d.status === "RUNNING") && d.hasFile && (
                      <SaveFileButton id={d.id} label={d.label} />
                    )}
                    {d.status === "DONE" && (
                      <SaveFileButton id={d.id} label={d.label} again />
                    )}
                    {d.status === "ERROR" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg border-border text-xs"
                        aria-label={`Retry ${d.label}`}
                        onClick={() => retry.mutate(d.id)}
                        disabled={retry.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    )}
                    {(d.status === "QUEUED" || d.status === "RUNNING") ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#EF5B6B]"
                        aria-label={`Cancel ${d.label}`}
                        onClick={() => cancel.mutate(d.id)}
                        disabled={cancel.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground"
                        aria-label={`Delete ${d.label}`}
                        onClick={() => remove.mutate(d.id)}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
