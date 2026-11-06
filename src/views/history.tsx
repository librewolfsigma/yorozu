"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { api, del } from "@/lib/client-api";
import { useAuth } from "@/components/providers";
import { timeAgo } from "@/lib/category-meta";
import { navigate } from "@/hooks/use-hash-route";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface HistoryResponse {
  entries: {
    id: string; action: string; category: string;
    detail: Record<string, unknown> | null;
    titleSnapshot: string | null; coverSnapshot: string | null;
    createdAt: string; mediaSlug: string | null;
  }[];
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  VIEW: { label: "Viewed", color: "#6C8299" },
  READ: { label: "Read", color: "#3ED6B0" },
  WATCH: { label: "Watched", color: "#3DB4F2" },
  PLAY: { label: "Played", color: "#FF6F91" },
  SEARCH: { label: "Searched", color: "#FFBE4A" },
  BROWSE: { label: "Browsed", color: "#AE8BFF" },
  IMPORT: { label: "Imported", color: "#3BD47A" },
  DOWNLOAD: { label: "Downloaded", color: "#FF8A4C" },
  INSTALL: { label: "Installed", color: "#3BD47A" },
};

export default function HistoryView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => api<HistoryResponse>("/api/history?limit=120"),
    enabled: !!user,
  });

  const clear = useMutation({
    mutationFn: () => del("/api/history"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["history"] });
      toast.success("History cleared");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <HistoryIcon className="h-10 w-10 text-muted-foreground" />
        <p className="mt-4 font-semibold">History</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">Everything you open, read and watch shows up here. Sign in to start tracking.</p>
      </div>
    );
  }

  const entries = data?.entries ?? [];

  return (
    <div className="pb-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFBE4A]/15 text-[#FFBE4A]">
          <HistoryIcon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-3xl text-white">History</h1>
          <p className="text-[13px] text-muted-foreground">{entries.length} recent events</p>
        </div>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[#EF5B6B] hover:bg-[#EF5B6B]/10 hover:text-[#EF5B6B]" onClick={() => clear.mutate()}>
            <Trash2 className="h-3.5 w-3.5" /> Clear history
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="yz-skeleton h-14 rounded-xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-semibold">No history yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Open a title to start your timeline.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => {
            const meta = ACTION_META[e.action] ?? ACTION_META.VIEW;
            const searchable = e.action === "SEARCH";
            const clickable = e.mediaSlug;
            return (
              <button
                key={e.id}
                onClick={() => (searchable ? navigate(`/search?q=${encodeURIComponent(String(e.titleSnapshot ?? ""))}`) : clickable ? navigate(`/media/${clickable}`) : undefined)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-white/5 disabled:cursor-default"
                disabled={!searchable && !clickable}
              >
                {e.coverSnapshot ? (
                   
                  <img src={e.coverSnapshot} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted font-bold text-muted-foreground">{e.action.slice(0, 1)}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">
                    {searchable ? `“${e.titleSnapshot}”` : e.titleSnapshot ?? `${meta.label} something`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.category !== "MISC" ? e.category.charAt(0) + e.category.slice(1).toLowerCase() + " · " : ""}
                    {timeAgo(e.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${meta.color}1a`, color: meta.color }}>
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
