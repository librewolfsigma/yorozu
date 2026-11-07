"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Library as LibraryIcon, Heart, Trash2, Play } from "lucide-react";
import { api, post } from "@/lib/client-api";
import { useAuth } from "@/components/providers";
import { GridSkeleton, CoverImg } from "@/components/media/card";
import { LIBRARY_STATUSES, categoryMeta, timeAgo } from "@/lib/category-meta";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

/** Display snapshot of an external work — Yozora stores only this bookmark. */
interface WorkRef {
  provider: string;
  externalId: string;
  ref: string;
  category: string;
  title: string;
  coverUrl: string | null;
}

interface LibraryResponse {
  entries: {
    id: string; status: string; progress: number; score: number | null;
    favorite: boolean; notes: string | null; updatedAt: string; work: WorkRef;
  }[];
  counts: Record<string, number>;
}

interface ProgressItem {
  provider: string; externalId: string; ref: string; category: string;
  kind: "EPISODE" | "CHAPTER" | "GALLERY" | string;
  unitKey: string; unitLabel: string | null;
  positionSec: number | null; pageIndex: number | null; completed: boolean;
  titleSnapshot: string | null; coverSnapshot: string | null; updatedAt: string;
}

export function mediaHref(provider: string, externalId: string): string {
  return `/media?p=${encodeURIComponent(provider)}&id=${encodeURIComponent(externalId)}`;
}

function continueHref(p: ProgressItem): string {
  const q = `p=${encodeURIComponent(p.provider)}&id=${encodeURIComponent(p.externalId)}`;
  if (p.kind === "EPISODE") return `/watch?${q}&ep=${encodeURIComponent(p.unitKey)}`;
  if (p.kind === "CHAPTER") return `/read?${q}&ch=${encodeURIComponent(p.unitKey)}`;
  if (p.kind === "GALLERY") return `/gallery?${q}`;
  return `/media?${q}`;
}

/** Poster tile for a snapshot-only work ref — mirrors the shared MediaCard look. */
export function RefPoster({ work }: { work: WorkRef }) {
  const meta = categoryMeta(work.category);
  const href = mediaHref(work.provider, work.externalId);
  return (
    <div
      className="poster-card group cursor-pointer select-none"
      onClick={() => navigate(href)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(href)}
      aria-label={`${work.title} (${meta.label})`}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-xl card-ring bg-[#141B30]"
        style={{ ["--hub" as string]: meta.hub }}
      >
        {work.coverUrl ? (
          <img
            src={work.coverUrl}
            alt={`${work.title} cover`}
            loading="lazy"
            className="poster-img h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: meta.hub, color: "#04121E" }}>
            <Play className="h-5 w-5 fill-current" />
          </div>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-1 text-[13px] font-semibold text-foreground/90 transition-colors group-hover:text-white">{work.title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          <span style={{ color: meta.hub }} className="font-semibold">{meta.label}</span>
        </p>
      </div>
    </div>
  );
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

  const { data: progress } = useQuery({
    queryKey: ["progress"],
    queryFn: () => api<{ recent: ProgressItem[] }>("/api/progress"),
    enabled: !!user,
  });

  const remove = useMutation({
    mutationFn: (work: WorkRef) => post("/api/library", { provider: work.provider, externalId: work.externalId, remove: true }),
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
          Track everything you read, watch and play across categories. No account needed — Yozora has no login.
        </p>
        <a href="#/settings" className="mt-4 text-sm font-semibold text-[#3DB4F2] hover:underline">Go to sign in →</a>
      </div>
    );
  }

  const entries = (data?.entries ?? []).filter((e) => tab === "ALL" || e.status === tab);
  const favs = (data?.entries ?? []).filter((e) => e.favorite);
  const continueRow = (progress?.recent ?? []).filter((p) => !p.completed).slice(0, 14);

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

      {/* continue strip — real saved positions, opened in the player/reader */}
      {continueRow.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-3 flex items-center gap-1.5 text-[15px] font-bold">
            <Play className="h-4 w-4 fill-[#3DB4F2] text-[#3DB4F2]" /> Continue
          </h2>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {continueRow.map((p) => {
              const meta = categoryMeta(p.category);
              return (
                <button
                  key={`${p.ref}:${p.unitKey}`}
                  onClick={() => navigate(continueHref(p))}
                  className="group w-[118px] shrink-0 text-left"
                  aria-label={`Continue ${p.titleSnapshot ?? "title"}${p.unitLabel ? ` — ${p.unitLabel}` : ""}`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl card-ring bg-[#141B30]">
                    {p.coverSnapshot ? (
                      <img src={p.coverSnapshot} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-muted" />
                    )}
                    <div className="absolute inset-x-1.5 bottom-1.5 z-[5] truncate rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                      {p.unitLabel ?? p.unitKey}
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-1 text-[12px] font-semibold text-foreground/90 transition-colors group-hover:text-white">
                    {p.titleSnapshot ?? "Untitled"}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    <span style={{ color: meta.hub }} className="font-semibold">{meta.label}</span> · {timeAgo(p.updatedAt)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

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
              <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {favs.map((e) => <RefPoster key={e.work.ref} work={e.work} />)}
              </div>
            </section>
          )}

          <section className="mt-7">
            {tab === "ALL" && favs.length > 0 && <h2 className="mb-3 text-[15px] font-bold">Everything</h2>}
            {entries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-16 text-center">
                <p className="font-semibold">Nothing here yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Open any title from Browse or Search and use “Add to library”.
                </p>
                <a href="#/browse/ANIME" className="mt-3 inline-block text-sm font-semibold text-[#3DB4F2] hover:underline">Browse sources →</a>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((e) => {
                  const meta = categoryMeta(e.work.category);
                  return (
                    <div
                      key={e.id}
                      className="group flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                      onClick={() => navigate(mediaHref(e.work.provider, e.work.externalId))}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(ev) => ev.key === "Enter" && navigate(mediaHref(e.work.provider, e.work.externalId))}
                      aria-label={`${e.work.title} — ${LIBRARY_STATUSES.find((s) => s.key === e.status)?.label ?? e.status}`}
                    >
                      {/* snapshot cover — display cache only, the work lives upstream */}
                      <CoverImg src={e.work.coverUrl} alt="" className="h-28 w-[74px] shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13.5px] font-bold leading-snug">{e.work.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          <span style={{ color: meta.hub }} className="font-semibold">{meta.label}</span>
                          {" "}· {e.work.provider}
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
                          remove.mutate(e.work);
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
