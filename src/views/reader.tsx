"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, ArrowLeft, Columns2, Rows3, Maximize2, Minimize2,
  Loader2, Check, Settings2, Download,
} from "lucide-react";
import { api, post } from "@/lib/client-api";
import { navigate } from "@/hooks/use-hash-route";
import { useAuth } from "@/components/providers";
import { categoryMeta } from "@/lib/category-meta";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface DetailPayload {
  media: { id: string; slug: string; title: string; category: string; accent: string | null; coverUrl: string | null };
  chapters: { id: string; number: number; title: string | null; pageCount: number }[];
  library: { status: string; progress: number } | null;
}

interface ChapterPayload {
  id: string;
  number: number;
  title: string | null;
  pageCount: number;
  pages: { id: string; idx: number; imageUrl: string; width: number; height: number }[];
}

export default function ReaderView({ slug, chapterId }: { slug?: string; chapterId?: string }) {
  const { user, demoLogin } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"paged" | "webtoon">("webtoon");
  const [pageIdx, setPageIdx] = useState(0);
  const [fitWidth, setFitWidth] = useState(true);
  const [showChrome, setShowChrome] = useState(true);
  const lastSyncRef = useRef<string>("");
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["media", slug],
    queryFn: () => api<DetailPayload>(`/api/media/${slug}`),
    enabled: !!slug,
  });

  const { data: chapter } = useQuery({
    queryKey: ["chapter", chapterId],
    queryFn: () => api<ChapterPayload>(`/api/chapters/${chapterId}`),
    enabled: !!chapterId,
  });

  const meta = detail ? categoryMeta(detail.media.category) : categoryMeta("MANGA");
  const hub = detail?.media.accent ?? meta.hub;

  // pick initial chapter if not provided
  useEffect(() => {
    if (!chapterId && detail && detail.chapters.length > 0) {
      navigate(`/read/${slug}/${detail.chapters[0].id}`);
    }
  }, [chapterId, detail, slug]);

  const chapterIdx = useMemo(
    () => (detail && chapter ? detail.chapters.findIndex((c) => c.id === chapter.id) : -1),
    [detail, chapter]
  );
  // chapters are ordered desc (newest first); reading order = reversed
  const nextChapter = detail && chapterIdx >= 0 ? detail.chapters[chapterIdx - 1] : undefined;
  const prevChapter = detail && chapterIdx >= 0 ? detail.chapters[chapterIdx + 1] : undefined;

  const syncProgress = useMutation({
    mutationFn: (payload: { itemId: string; pageIndex: number; completed: boolean }) =>
      post("/api/progress", {
        mediaId: detail?.media.id,
        itemId: payload.itemId,
        kind: "CHAPTER",
        pageIndex: payload.pageIndex,
        completed: payload.completed,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media", slug] }),
  });

  const goPage = useCallback(
    (delta: number) => {
      if (!chapter) return;
      setPageIdx((i) => Math.min(chapter.pageCount - 1, Math.max(0, i + delta)));
    },
    [chapter]
  );

  // keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "d") goPage(1);
      if (e.key === "ArrowLeft" || e.key === "a") goPage(-1);
      if (e.key === "w") setMode((m) => (m === "paged" ? "webtoon" : "paged"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPage]);

  // progress sync (paged mode): debounce per page
  useEffect(() => {
    if (!chapter || mode !== "paged" || !user) return;
    const key = `${chapter.id}:${pageIdx}`;
    if (lastSyncRef.current === key) return;
    lastSyncRef.current = key;
    syncProgress.mutate({
      itemId: chapter.id,
      pageIndex: pageIdx,
      completed: pageIdx >= chapter.pageCount - 1,
    });
  }, [chapter, pageIdx, mode, user]);

  // progress sync (webtoon): intersection observer
  useEffect(() => {
    if (!chapter || mode !== "webtoon" || !user) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) {
              setPageIdx(idx);
              const key = `${chapter.id}:${idx}`;
              if (lastSyncRef.current !== key) {
                lastSyncRef.current = key;
                syncProgress.mutate({
                  itemId: chapter.id,
                  pageIndex: idx,
                  completed: idx >= chapter.pageCount - 1,
                });
              }
            }
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [chapter, mode, user]);

  if (isLoading || !detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080f19]">
        <Loader2 className="h-8 w-8 animate-spin text-[#3DB4F2]" />
      </div>
    );
  }

  const pages = chapter?.pages ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#080f19]" style={{ ["--hub" as string]: hub }}>
      {/* top chrome */}
      <header
        className={cn(
          "z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-[#0B1622]/95 px-3 backdrop-blur transition-transform duration-300",
          !showChrome && "-translate-y-full"
        )}
      >
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground" onClick={() => navigate(`/media/${slug}`)}>
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{detail.media.title}</span>
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[13px] font-bold text-white">
            Chapter {chapter?.number ?? "—"} {chapter?.title ? `— ${chapter.title}` : ""}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {pages.length > 0 ? `Page ${pageIdx + 1} / ${pages.length}` : "Loading…"}
          </p>
        </div>

        {/* chapter select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground">
              <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Chapters</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto rounded-xl border-border">
            <DropdownMenuLabel className="text-xs text-muted-foreground">{detail.chapters.length} chapters</DropdownMenuLabel>
            {detail.chapters.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => navigate(`/read/${slug}/${c.id}`)} className={cn("gap-2", c.id === chapterId && "hub-text font-bold")}>
                Ch. {c.number} {c.title ? `— ${c.title}` : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground" onClick={() => setMode((m) => (m === "paged" ? "webtoon" : "paged"))}>
          {mode === "paged" ? <Rows3 className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
          <span className="hidden sm:inline">{mode === "paged" ? "Paged" : "Long strip"}</span>
        </Button>

        <button
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground sm:flex"
          onClick={() => {
            const el = document.documentElement;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void el.requestFullscreen();
          }}
          aria-label="Toggle fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </header>

      {/* reading area */}
      <div className="relative flex-1 overflow-y-auto" onClick={() => setShowChrome((s) => !s)}>
        {!user && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-[#FFBE4A]/15 px-4 py-2 text-xs text-[#FFBE4A]">
            <span>Progress tracking is off — sign in to sync your reading position.</span>
            <button className="font-bold underline" onClick={(e) => { e.stopPropagation(); void demoLogin(); }}>
              Demo login
            </button>
          </div>
        )}

        {mode === "paged" ? (
          <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
            {pages[pageIdx] && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                { }
                <img
                  src={pages[pageIdx].imageUrl}
                  alt={`Page ${pageIdx + 1}`}
                  className={cn("reader-page-img rounded-lg shadow-2xl", fitWidth ? "w-full max-w-3xl" : "max-h-[calc(100vh-8rem)]")}
                />
                {/* tap zones */}
                <button className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize" aria-label="Previous page" onClick={(e) => { e.stopPropagation(); goPage(-1); }} />
                <button className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize" aria-label="Next page" onClick={(e) => { e.stopPropagation(); goPage(1); }} />
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-1.5 p-2 sm:p-4">
            {pages.map((p, i) => (
              <div key={p.id} ref={(el) => { pageRefs.current[i] = el; }} data-idx={i}>
                { }
                <img src={p.imageUrl} alt={`Page ${i + 1}`} loading="lazy" className="reader-page-img w-full rounded-lg shadow" />
              </div>
            ))}
          </div>
        )}

        {/* end of chapter */}
        {chapter && pageIdx >= pages.length - 1 && (
          <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm font-bold">
                <Check className="h-4 w-4" style={{ color: hub }} /> Chapter {chapter.number} finished
                {user && " — progress saved"}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {nextChapter && (
                  <Button className="rounded-xl border-0 text-[#04121E]" style={{ background: hub }} onClick={() => navigate(`/read/${slug}/${nextChapter.id}`)}>
                    Next: Ch. {nextChapter.number} <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                {prevChapter && (
                  <Button variant="outline" className="rounded-xl border-border" onClick={() => navigate(`/read/${slug}/${prevChapter.id}`)}>
                    <ChevronLeft className="h-4 w-4" /> Prev: Ch. {prevChapter.number}
                  </Button>
                )}
                <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/media/${slug}`); }}>
                  Back to details
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* bottom chrome (paged) */}
      {mode === "paged" && (
        <footer className={cn("z-10 flex h-16 shrink-0 items-center gap-3 border-t border-border/70 bg-[#0B1622]/95 px-4 backdrop-blur transition-transform duration-300", !showChrome && "translate-y-full")}>
          <Button variant="ghost" size="sm" className="gap-1 rounded-lg" onClick={(e) => { e.stopPropagation(); goPage(-1); }}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <input
            type="range"
            min={0}
            max={Math.max(0, pages.length - 1)}
            value={pageIdx}
            onChange={(e) => setPageIdx(Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#23324A] accent-[var(--hub)]"
            aria-label="Page position"
          />
          <Button variant="ghost" size="sm" className="gap-1 rounded-lg" onClick={(e) => { e.stopPropagation(); goPage(1); }}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
          <button
            className="hidden h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground sm:flex"
            onClick={(e) => { e.stopPropagation(); setFitWidth((f) => !f); }}
          >
            {fitWidth ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {fitWidth ? "Fit width" : "Fit height"}
          </button>
          <DownloadButtonInline hub={hub} />
        </footer>
      )}
    </div>
  );
}

function DownloadButtonInline({ hub }: { hub: string }) {
  return (
    <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex" title="Chapter downloads respect provider permissions">
      <Download className="h-3.5 w-3.5" style={{ color: hub }} /> Offline-ready
    </span>
  );
}
