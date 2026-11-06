"use client";

// Reader — vertical (webtoon) + paged modes over pages resolved live.
// Chapters come from /api/work in two honest shapes (see the route):
//   - inline `pages[]` (already displayable, /api/img-proxied), or
//   - `resolveUrl` token → resolved on demand via /api/pages (at-home etc.).
// Nothing is cached beyond react-query's short staleTime — upstream URLs expire.

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, ArrowLeft, Columns2, Rows3, Maximize2, Minimize2,
  Loader2, Check, Settings2, AlertTriangle, Image as ImageIcon, ExternalLink,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { navigate } from "@/hooks/use-hash-route";
import { useAuth } from "@/components/providers";
import { categoryMeta } from "@/lib/category-meta";
import { reportProgress } from "@/views/watch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkDTO } from "@/lib/serialize";

interface ChapterUnit {
  key: string; number: number; title: string | null;
  pageCount: number | null; pages: string[] | null; resolveUrl: string | null;
}
interface GalleryImage { url: string; thumbUrl: string | null; width: number; height: number; tags: string[]; }
interface WorkDetail {
  work: WorkDTO;
  units: { episodes: { key: string }[]; chapters: ChapterUnit[]; images: GalleryImage[] };
  ref: string;
}

export default function ReaderView({ provider, id, chapterKey }: { provider?: string | null; id?: string | null; chapterKey?: string | null }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["work", provider, id],
    queryFn: () => api<WorkDetail>(`/api/work?p=${encodeURIComponent(provider!)}&id=${encodeURIComponent(id!)}`),
    enabled: !!provider && !!id,
  });

  const work = data?.work ?? null;
  // normalized reading order: newest first (next chapter = index-1), regardless
  // of the order the adapter streams them in
  const chapters = useMemo(
    () => [...(data?.units.chapters ?? [])].sort((a, b) => b.number - a.number),
    [data?.units.chapters]
  );
  const chapter = chapters.find((c) => c.key === chapterKey) ?? chapters[0] ?? null;

  const enc = encodeURIComponent;
  const backHref = provider && id ? `/media?p=${enc(provider)}&id=${enc(id)}` : "/";
  const readHref = (key: string) => `/read?p=${enc(provider!)}&id=${enc(id!)}&ch=${enc(key)}`;

  // page source: (a) inline array, (b) live resolution via /api/pages
  const needsResolve = !!chapter && !chapter.pages && !!chapter.resolveUrl;
  const pagesQuery = useQuery({
    queryKey: ["pages", provider, chapter?.resolveUrl],
    queryFn: () => api<{ pages: { idx: number; imageUrl: string }[] }>(
      `/api/pages?p=${enc(provider!)}&url=${encodeURIComponent(chapter!.resolveUrl!)}`
    ),
    enabled: needsResolve && !!provider,
    staleTime: 240_000, // upstream page URLs expire — stay strictly under their TTL
  });

  const pages = useMemo<string[]>(() => {
    if (chapter?.pages && chapter.pages.length > 0) return chapter.pages;
    if (pagesQuery.data?.pages?.length) return pagesQuery.data.pages.map((p) => p.imageUrl);
    return [];
  }, [chapter?.pages, pagesQuery.data]);

  // ── loading / error states ──
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col gap-4 bg-[#080f19] p-4">
        <div className="yz-skeleton h-10 rounded-xl" />
        <div className="yz-skeleton mx-auto w-full max-w-3xl flex-1 rounded-2xl" />
      </div>
    );
  }
  if (isError || !data || !work) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-[#080f19] px-4">
        <AlertTriangle className="h-8 w-8 text-[#EF5B6B]" />
        <p className="font-semibold">Could not open this title</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">{(error as Error)?.message ?? "The provider may be unreachable right now."}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetch()}>Retry</Button>
          <Button variant="ghost" onClick={() => navigate(backHref)}>Back to details</Button>
        </div>
      </div>
    );
  }

  // no chapters, but the source exposes images → render them gallery-style
  if (!chapter) {
    if (data.units.images.length > 0) {
      return <GalleryFallback data={data} backHref={backHref} />;
    }
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-[#080f19] px-4">
        <AlertTriangle className="h-8 w-8 text-[#FFBE4A]" />
        <p className="font-semibold">This source exposes no chapters to read in-app</p>
        {work.externalLinks.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {work.externalLinks.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[13px] font-bold" style={{ borderColor: `${work.accent}44`, background: `${work.accent}14`, color: work.accent }}>
                <ExternalLink className="h-3.5 w-3.5" /> {l.label}
              </a>
            ))}
          </div>
        )}
        <Button variant="ghost" onClick={() => navigate(backHref)}>← Back to details</Button>
      </div>
    );
  }

  return (
    <ChapterReader
      // keyed remount resets reader state (page index, chrome, observers) per chapter
      key={chapter.key}
      work={work}
      chapters={chapters}
      chapter={chapter}
      pages={pages}
      pagesLoading={needsResolve && pagesQuery.isLoading}
      pagesFailed={needsResolve && pagesQuery.isError}
      pagesError={pagesQuery.error as Error | null}
      onPagesRetry={() => void pagesQuery.refetch()}
      readHref={readHref}
      backHref={backHref}
    />
  );
}

interface ChapterReaderProps {
  work: WorkDTO;
  chapters: ChapterUnit[];
  chapter: ChapterUnit;
  pages: string[];
  pagesLoading: boolean;
  pagesFailed: boolean;
  pagesError: Error | null;
  onPagesRetry: () => void;
  readHref: (key: string) => string;
  backHref: string;
}

function ChapterReader({ work, chapters, chapter, pages, pagesLoading, pagesFailed, pagesError, onPagesRetry, readHref, backHref }: ChapterReaderProps) {
  const { user, demoLogin } = useAuth();
  const [mode, setMode] = useState<"paged" | "webtoon">("webtoon");
  const [pageIdx, setPageIdx] = useState(0);
  const [fitWidth, setFitWidth] = useState(true);
  const [showChrome, setShowChrome] = useState(true);
  const lastSyncRef = useRef<string>("");
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const meta = categoryMeta(work.category);
  const hub = work.accent || meta.hub;

  const chapterIdx = chapters.findIndex((c) => c.key === chapter.key);
  // chapters are ordered desc (newest first); reading order = reversed
  const nextChapter = chapterIdx > 0 ? chapters[chapterIdx - 1] : undefined;
  const prevChapter = chapterIdx >= 0 && chapterIdx < chapters.length - 1 ? chapters[chapterIdx + 1] : undefined;

  const goPage = useCallback(
    (delta: number) => {
      setPageIdx((i) => Math.min(pages.length - 1, Math.max(0, i + delta)));
    },
    [pages.length]
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

  const syncPage = useCallback(
    (idx: number) => {
      if (!user) return;
      const key = `${chapter.key}:${idx}`;
      if (lastSyncRef.current === key) return;
      lastSyncRef.current = key;
      reportProgress({
        provider: work.provider, externalId: work.externalId, category: work.category,
        title: work.title, cover: work.coverUrl ?? undefined,
        kind: "CHAPTER", unitKey: chapter.key, unitLabel: `Chapter ${chapter.number}`,
        pageIndex: idx, completed: pages.length > 0 && idx >= pages.length - 1,
      });
    },
    [user, work, chapter, pages.length]
  );

  // progress sync (paged mode): once per page change
  useEffect(() => {
    if (mode !== "paged" || pages.length === 0) return;
    syncPage(pageIdx);
  }, [mode, pageIdx, pages.length, syncPage]);

  // progress sync (webtoon): intersection observer
  useEffect(() => {
    if (mode !== "webtoon" || pages.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) {
              setPageIdx(idx);
              syncPage(idx);
            }
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [mode, pages, syncPage]);

  const pageCount = chapter.pageCount ?? (pages.length || null);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#080f19]" style={{ ["--hub" as string]: hub }}>
      {/* top chrome */}
      <header
        className={cn(
          "z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-[#0B1622]/95 px-3 backdrop-blur transition-transform duration-300",
          !showChrome && "-translate-y-full"
        )}
      >
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground" onClick={() => navigate(backHref)}>
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{work.title}</span>
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[13px] font-bold text-white">
            Chapter {chapter.number} {chapter.title ? `— ${chapter.title}` : ""}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {pagesFailed
              ? "Pages failed to load"
              : pagesLoading
                ? "Loading pages…"
                : pages.length > 0
                  ? `Page ${pageIdx + 1} / ${pages.length}`
                  : pageCount
                    ? `${pageCount} pages`
                    : "Loading…"}
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
            <DropdownMenuLabel className="text-xs text-muted-foreground">{chapters.length} chapters · newest first</DropdownMenuLabel>
            {chapters.map((c) => (
              <DropdownMenuItem key={c.key} onClick={() => navigate(readHref(c.key))} className={cn("gap-2", c.key === chapter.key && "hub-text font-bold")}>
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

        {pagesLoading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: hub }} />
            <p className="text-sm text-muted-foreground">Resolving pages live from {work.providerName}…</p>
          </div>
        )}

        {pagesFailed && (
          <div className="mx-auto m-6 max-w-md rounded-2xl border border-border bg-card p-6 text-center">
            <AlertTriangle className="mx-auto h-9 w-9 text-[#EF5B6B]" />
            <p className="mt-3 font-bold">Pages failed to load</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {pagesError?.message ?? "The source did not return any pages. Its links may have expired."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={onPagesRetry}>Retry</Button>
              {work.externalLinks.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-[13px] font-bold" style={{ borderColor: `${hub}44`, background: `${hub}14`, color: hub }}>
                  <ExternalLink className="h-3.5 w-3.5" /> {l.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {!pagesLoading && !pagesFailed && pages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <ImageIcon className="h-7 w-7" />
            <p className="text-sm">No pages are available for this chapter.</p>
          </div>
        )}

        {mode === "paged" ? (
          pages.length > 0 && (
            <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <img
                  src={pages[pageIdx]}
                  alt={`Page ${pageIdx + 1}`}
                  className={cn("reader-page-img rounded-lg shadow-2xl", fitWidth ? "w-full max-w-3xl" : "max-h-[calc(100vh-8rem)]")}
                />
                {/* tap zones */}
                <button className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize" aria-label="Previous page" onClick={(e) => { e.stopPropagation(); goPage(-1); }} />
                <button className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize" aria-label="Next page" onClick={(e) => { e.stopPropagation(); goPage(1); }} />
              </div>
            </div>
          )
        ) : (
          pages.length > 0 && (
            <div className="mx-auto max-w-3xl space-y-1.5 p-2 sm:p-4">
              {pages.map((src, i) => (
                <div key={`${src.slice(0, 48)}-${i}`} ref={(el) => { pageRefs.current[i] = el; }} data-idx={i}>
                  <img src={src} alt={`Page ${i + 1}`} loading="lazy" className="reader-page-img w-full rounded-lg shadow" />
                </div>
              ))}
            </div>
          )
        )}

        {/* end of chapter */}
        {!pagesLoading && !pagesFailed && pages.length > 0 && pageIdx >= pages.length - 1 && (
          <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm font-bold">
                <Check className="h-4 w-4" style={{ color: hub }} /> Chapter {chapter.number} finished
                {user && " — progress saved"}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {nextChapter && (
                  <Button className="rounded-xl border-0 text-[#04121E]" style={{ background: hub }} onClick={() => navigate(readHref(nextChapter.key))}>
                    Next: Ch. {nextChapter.number} <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                {prevChapter && (
                  <Button variant="outline" className="rounded-xl border-border" onClick={() => navigate(readHref(prevChapter.key))}>
                    <ChevronLeft className="h-4 w-4" /> Prev: Ch. {prevChapter.number}
                  </Button>
                )}
                <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={(e) => { e.stopPropagation(); navigate(backHref); }}>
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
        </footer>
      )}
    </div>
  );
}

// Chapter-less image sources (booru-style) — render the work's images
// gallery-style inside the reader chrome. Viewing only, no invented actions.
function GalleryFallback({ data, backHref }: { data: WorkDetail; backHref: string }) {
  const { work, units } = data;
  const hub = work.accent || categoryMeta(work.category).hub;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#080f19]" style={{ ["--hub" as string]: hub }}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-[#0B1622]/95 px-3 backdrop-blur">
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground" onClick={() => navigate(backHref)}>
          <ArrowLeft className="h-4 w-4" /> <span className="hidden truncate sm:inline">{work.title}</span>
        </Button>
        <div className="flex-1 text-center">
          <p className="text-[13px] font-bold text-white">{units.images.length} images · via {work.providerName}</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-1.5 p-2 sm:p-4">
          {units.images.map((g, i) => (
            <img key={g.url} src={g.thumbUrl ?? g.url} alt={`Image ${i + 1}`} loading="lazy" className="reader-page-img w-full rounded-lg shadow" />
          ))}
        </div>
      </div>
    </div>
  );
}
