"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Check, Loader2, AlertTriangle } from "lucide-react";
import { post } from "@/lib/client-api";
import { toast } from "sonner";

export function ImportButton({
  catalogItemId,
  imported,
  size = "sm",
  onImported,
}: {
  catalogItemId: string;
  imported: boolean;
  size?: "sm" | "default";
  onImported?: (slug: string) => void;
}) {
  const qc = useQueryClient();
  const [merged, setMerged] = useState(false);
  const mutation = useMutation({
    mutationFn: () => post<{ slug: string; merged: boolean }>("/api/media/import", { catalogItemId }),
    onSuccess: (data) => {
      setMerged(true);
      void qc.invalidateQueries();
      toast.success(data.merged ? "Merged with existing entry" : "Imported to database", {
        description: data.merged
          ? "Duplicate detected — provider linked to the unified title."
          : "The title is now searchable platform-wide.",
      });
      onImported?.(data.slug);
    },
    onError: (e: Error) => toast.error("Import failed", { description: e.message }),
  });

  if (imported) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-[#3BD47A]" /> Imported
      </span>
    );
  }

  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        merged ? "bg-[#3BD47A]/15 text-[#3BD47A]" : "hub-soft hub-text hover:brightness-125 press-scale"
      }`}
      style={{ ["--hub" as string]: "var(--hub)" }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        mutation.mutate();
      }}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : merged ? (
        <>
          <Check className="h-3.5 w-3.5" /> Imported
        </>
      ) : (
        <>
          <Link2 className="h-3.5 w-3.5" /> Import
        </>
      )}
    </button>
  );
}

export function ProviderOfflineNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[#FFBE4A]/30 bg-[#FFBE4A]/10 p-2.5 text-xs text-foreground/80">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFBE4A]" />
      <span>This provider result is not yet merged into the unified database. Install its provider, then import.</span>
    </div>
  );
}
