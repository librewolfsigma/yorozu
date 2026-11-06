"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Library as LibraryIcon, Heart, Trash2 } from "lucide-react";
import { api, post } from "@/lib/client-api";
import { useAuth } from "@/components/providers";
import { MediaGrid, GridSkeleton, fromDTO } from "@/components/media/card";
import { LIBRARY_STATUSES, categoryMeta } from "@/lib/category-meta";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { navigate } from "@/hooks/use-hash-route";
import type { MediaDTO } from "@/lib/serialize";

interface LibraryResponse {
  entries: {
    id: string; status: string; progress: number; score: number | null;
    favorite: boolean; updatedAt: string; media: MediaDTO;
  }[];
  counts: Record<string, number>;
}

export default function LibraryView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["library"],
    queryFn: () => api<LibraryResponse>("/api/library"),
    enabled: !!user,
  });

  const remove = useMutation({
    mutationFn: (mediaId: string) => post("/api/library", { mediaId, remove: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Removed from library");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <LibraryIcon className="h-10 w-10 text-muted-foreground" />
        <p className="mt-4 font-semibold">Your library lives here</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Track everything you read, watch and play across categories. Sign in to get started.
        </p>
        <a href="#/settings" className="mt-4 text-sm font-semibold text-[#3DB4F2] hover:underline">Go to sign in →</a>
      </div>
    );
  }

  const entries = (data?.entries ?? []).filter((e) => tab === "ALL" || e.status === tab);
  const favs = (data?.entries ?? []).filter((e) => e.favorite);

  return (
    <div className="pb-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3DB4F2]/15 text-[#3DB4F2]">
          <LibraryIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl text-white">My Library</h1>
          <p className="text-[13px] text-muted-foreground">
            {data ? `${data.entries.length} titles tracked` : "Loading…"}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap gap-1 rounded-xl bg-card">
          <TabsTrigger value="ALL" className="rounded-lg">All ({data?.entries.length ?? 0})</TabsTrigger>
          {LIBRARY_STATUSES.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="rounded-lg">
              {s.label} ({data?.counts?.[s.key] ?? 0})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="mt-6"><GridSkeleton count={12} /></div>
      ) : (
        <>
          {tab === "ALL" && favs.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-3 flex items-center gap-1.5 text-[15px] font-bold">
                <Heart className="h-4 w-4 fill-[#FF6F91] text-[#FF6F91]" /> Favorites ({favs.length})
              </h2>
              <MediaGrid items={favs.map((e) => fromDTO(e.media))} />
            </section>
          )}

          <section className="mt-7">
            {tab === "ALL" && favs.length > 0 && <h2 className="mb-3 text-[15px] font-bold">Everything</h2>}
            {entries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-16 text-center">
                <p className="font-semibold">Nothing here yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Browse the catalog and use “Add to library” on any title.
                </p>
                <a href="#/browse/ANIME" className="mt-3 inline-block text-sm font-semibold text-[#3DB4F2] hover:underline">Browse catalog →</a>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((e) => {
                  const meta = categoryMeta(e.media.category);
                  return (
                    <div
                      key={e.id}
                      className="group flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                      onClick={() => navigate(`/media/${e.media.slug}`)}
                    >
                      { }
                      <img src={e.media.coverUrl ?? ""} alt="" className="h-28 w-[74px] shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13.5px] font-bold leading-snug">{e.media.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          <span style={{ color: meta.hub }} className="font-semibold">{meta.label}</span>
                          {e.media.year ? <> · {e.media.year}</> : null}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {LIBRARY_STATUSES.find((s) => s.key === e.status)?.label ?? e.status}
                          </span>
                          {e.progress > 0 && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${meta.hub}1a`, color: meta.hub }}>
                              {meta.unit} {e.progress}
                            </span>
                          )}
                          {e.score != null && (
                            <span className="rounded-full bg-[#FFBE4A]/15 px-2 py-0.5 text-[10px] font-bold text-[#FFBE4A]">
                              {e.score}/10
                            </span>
                          )}
                          {e.favorite && <Heart className="h-3 w-3 fill-[#FF6F91] text-[#FF6F91]" />}
                        </div>
                      </div>
                      <button
                        className={cn("self-start rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-[#EF5B6B]/15 hover:text-[#EF5B6B] group-hover:opacity-100")}
                        aria-label="Remove from library"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          remove.mutate(e.media.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
