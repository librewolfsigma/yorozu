"use client";

// Booru browser — the Danbooru-client-style UI for SINGLE images.
//
// This is deliberately a DIFFERENT UI from every other category:
//   - masonry waterfall grid of image posts (natural aspect ratios)
//   - tag-driven search (click any tag to search it)
//   - lightbox viewer with full image, grouped tags, score/date meta,
//     keyboard navigation (← → Esc) and prev/next
//   - infinite scroll over the paged multi-provider feed
//
// Backed by the same /api/feed engine (e621 · yande.re · Hypnohub · Gelbooru)
// — live upstream pulls, TTL-cached, nothing stored locally.

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, X, ChevronLeft, ChevronRight, Loader2, AlertTriangle, RefreshCw,
  ExternalLink, Flame, Clock, Info, Tag,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";
import { fmtNumber } from "@/lib/category-meta";
import type { WorkDTO } from "@/lib/serialize";

interface FeedResponse {
  category: string;
  page: number;
  items: WorkDTO[];
  hasMore: boolean;
  providers: { id: string; name: string; error: string | null; count: number }[];
}

const VIDEO_EXTS = new Set(["WEBM", "MP4", "MOV"]);

function extOf(item: WorkDTO): string {
  return (item.format ?? "").toUpperCase();
}

function fullUrl(item: WorkDTO): string | null {
  return item.bannerUrl ?? item.coverUrl ?? null;
}

function proxied(url: string): string {
  return `/api/img?u=${encodeURIComponent(url)}`;
}

export default function BooruView({ tag }: { tag?: string }) {
  const [query, setQuery] = useState(tag ?? "");
  const [mode, setMode] = useState<"popular" | "recent">("popular");
  // Lightbox tracks the OPEN ITEM's external ref (not an index) so a new
  // search result set closes it naturally — no reset effect needed.
  const [openRef, setOpenRef] = useState<string | null>(null);

  const effectiveQ = useMemo(() => {
    const q = query.trim();
    if (q) return q;
    return mode === "recent" ? "order:id" : "";
  }, [query, mode]);

  const q = useInfiniteQuery({
    queryKey: ["booru-feed", effectiveQ],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<FeedResponse>(`/api/feed?category=ILLUSTRATION&q=${encodeURIComponent(effectiveQ)}&page=${pageParam}`),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const flat: WorkDTO[] = [];
    for (const page of q.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.ref)) continue;
        seen.add(item.ref);
        flat.push(item);
      }
    }
    return flat;
  }, [q.data]);

  const providers = q.data?.pages.at(-1)?.providers ?? [];

  const openIdx = openRef ? items.findIndex((i) => i.ref === openRef) : -1;
  const current = openIdx >= 0 ? items[openIdx] : null;

  const step = (dir: 1 | -1) => {
    if (openIdx < 0) return;
    const next = openIdx + dir;
    if (next < 0) return;
    if (next >= items.length) {
      if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      return;
    }
    setOpenRef(items[next].ref);
  };

  // infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage, items.length]);

  return (
    <div className="pb-6" style={{ ["--hub" as string]: "#AE8BFF" }}>
      {/* header + tag search */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl hub-soft" style={{ color: "#AE8BFF" }}>
          <Tag className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-3xl text-white">Images (Booru)</h1>
          <p className="text-[13px] text-muted-foreground">
            Single-image boards — tag search, masonry grid, lightbox viewer. Live from e621 · yande.re · Hypnohub.
          </p>
        </div>
        <button
          onClick={() => void q.refetch()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(query.trim());
        }}
        className="mb-4 flex gap-2"
      >
        <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by tags — e.g. artist name, character, order:score…"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            aria-label="Tag search"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear tag search">
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </form>

      {/* mode chips + source health */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex gap-1.5">
          <ModeChip active={mode === "popular" && !query} onClick={() => { setMode("popular"); setQuery(""); }} icon={<Flame className="h-3.5 w-3.5" />} label="Popular" />
          <ModeChip active={mode === "recent" && !query} onClick={() => { setMode("recent"); setQuery(""); }} icon={<Clock className="h-3.5 w-3.5" />} label="Recent" />
          {query.trim() && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold text-[#AE8BFF]"
              style={{ borderColor: "#AE8BFF55", background: "#AE8BFF1f" }}
            >
              <Search className="h-3 w-3" /> {query.trim()}
            </span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {providers.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground" title={p.error ?? `${p.count} posts`}>
              <span className={cn("h-1.5 w-1.5 rounded-full", p.error ? "bg-[#EF5B6B]" : p.count > 0 ? "bg-[#3BD47A]" : "bg-muted-foreground/40")} />
              {p.name}
            </span>
          ))}
        </div>
      </div>

      {/* masonry grid — natural aspect ratios, Danbooru-client style */}
      {q.isError ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-[#EF5B6B]/40 py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-[#EF5B6B]" />
          <p className="mt-3 font-semibold">Could not load the image feed</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{(q.error as Error)?.message}</p>
          <button onClick={() => void q.refetch()} className="mt-4 rounded-lg bg-[#AE8BFF]/15 px-4 py-2 text-sm font-bold text-[#AE8BFF]">
            Retry
          </button>
        </div>
      ) : items.length === 0 && q.isLoading ? (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="yz-skeleton mb-3 break-inside-avoid rounded-xl" style={{ height: 140 + ((i * 67) % 180) }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
          <Search className="h-9 w-9 text-muted-foreground" />
          <p className="mt-3 font-semibold">No posts matched</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Booru tags are exact — try a different tag combination, or clear the search for the default popular feed.
          </p>
        </div>
      ) : (
        <>
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
            {items.map((item) => (
              <BooruCard key={item.ref} item={item} onOpen={() => setOpenRef(item.ref)} />
            ))}
          </div>
          <div ref={sentinelRef} aria-hidden className="h-1" />
          <div className="mt-6 flex items-center justify-center gap-2 pb-2 text-sm text-muted-foreground" aria-live="polite">
            {q.isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading more posts…
              </>
            ) : q.hasNextPage ? (
              <button onClick={() => void q.fetchNextPage()} className="rounded-lg px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground">
                Load more
              </button>
            ) : (
              <p className="text-[13px]">End of current upstream results — new posts appear as sources add them.</p>
            )}
          </div>
        </>
      )}

      {/* lightbox */}
      {current && (
        <Lightbox
          item={current}
          onClose={() => setOpenRef(null)}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onTagClick={(t) => {
            setOpenRef(null);
            setMode("popular");
            setQuery(t);
            window.scrollTo({ top: 0 });
          }}
          position={openIdx}
        />
      )}
    </div>
  );
}

function ModeChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all",
        active ? "border-transparent text-[#AE8BFF]" : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
      style={active ? { background: "#AE8BFF1f" } : undefined}
    >
      {icon} {label}
    </button>
  );
}

// ─── Masonry card ───────────────────────────────────────────────────────────

function BooruCard({ item, onOpen }: { item: WorkDTO; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const src = item.coverUrl ?? item.bannerUrl;
  const isVideo = VIDEO_EXTS.has(extOf(item));
  return (
    <button
      onClick={onOpen}
      className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border border-border bg-card text-left"
      aria-label={`Open ${item.title} in viewer`}
    >
      {src && !failed ? (
        isVideo ? (
          <div className="flex min-h-[140px] w-full items-center justify-center bg-black/40 py-8">
            <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white">▶ {extOf(item)}</span>
          </div>
        ) : (
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        )
      ) : (
        <div className="flex min-h-[140px] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
          {isVideo ? `▶ ${extOf(item)}` : "preview unavailable — open to load"}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="line-clamp-1 text-[11.5px] font-semibold text-white">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[10.5px] text-white/75">
          {item.rating != null && item.rating > 0 && <span className="font-bold text-[#FFBE4A]">★ {fmtNumber(Math.round(item.rating))}</span>}
          <span className="rounded bg-white/15 px-1.5 py-0.5 font-bold">{extOf(item) || "IMG"}</span>
          <span>{item.providerName}</span>
        </p>
      </div>
    </button>
  );
}

// ─── Lightbox viewer ────────────────────────────────────────────────────────

const TAG_GROUPS: { prefix: string; label: string; color: string }[] = [
  { prefix: "artist:", label: "Artist", color: "#FF8AC2" },
  { prefix: "character:", label: "Character", color: "#3BD47A" },
  { prefix: "copyright:", label: "Series", color: "#AE8BFF" },
  { prefix: "species:", label: "Species", color: "#FF8A4C" },
  { prefix: "meta:", label: "Meta", color: "#FFBE4A" },
];

function groupTags(tags: string[]) {
  const groups = new Map<string, { label: string; color: string; tags: string[] }>();
  const general: string[] = [];
  for (const t of tags) {
    const g = TAG_GROUPS.find((x) => t.toLowerCase().startsWith(x.prefix));
    if (g) {
      const cur = groups.get(g.prefix) ?? { label: g.label, color: g.color, tags: [] };
      cur.tags.push(t.slice(g.prefix.length));
      groups.set(g.prefix, cur);
    } else {
      general.push(t);
    }
  }
  return { groups: [...groups.values()], general };
}

function Lightbox({
  item, onClose, onPrev, onNext, onTagClick, position,
}: {
  item: WorkDTO;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTagClick: (tag: string) => void;
  position: number;
}) {
  const url = fullUrl(item);
  // Track the FAILED URL (not a boolean) so switching posts resets the
  // fallback naturally — derived state, no reset effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const mediaFailed = failedUrl !== null && failedUrl === url;
  const isVideo = VIDEO_EXTS.has(extOf(item));
  const { groups, general } = useMemo(() => groupTags(item.tags), [item.tags]);
  const extra = item.extra as { width?: number; height?: number; rating?: string; source?: string } | undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext]);

  const shownSrc = url ? (mediaFailed ? proxied(url) : url) : null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/92 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Image viewer — ${item.title}`}>
      {/* top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-3">
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close viewer">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold text-white">{item.title}</p>
          <p className="text-[11px] text-white/50">
            #{item.externalId} · {item.providerName} · post {position + 1}
            {extra?.width ? ` · ${extra.width}×${extra.height}` : ""}
            {extra?.rating ? ` · rating: ${extra.rating}` : ""}
          </p>
        </div>
        <button
          onClick={() => navigate(`/media?p=${encodeURIComponent(item.provider)}&id=${encodeURIComponent(item.externalId)}`)}
          className="hidden items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-bold text-white/80 hover:bg-white/10 sm:inline-flex"
        >
          <Info className="h-3.5 w-3.5" /> Details
        </button>
        {item.externalUrl && (
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-bold text-white/80 hover:bg-white/10"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Source
          </a>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* media stage */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 lg:p-6">
          <button
            onClick={onPrev}
            className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/85 hover:text-white"
            aria-label="Previous post"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={onNext}
            className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/85 hover:text-white"
            aria-label="Next post"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {shownSrc && isVideo ? (
            <video
              key={shownSrc}
              src={shownSrc}
              controls
              autoPlay
              loop
              muted
              playsInline
              className="max-h-full max-w-full rounded-lg"
            />
          ) : shownSrc ? (
            <img
              key={shownSrc}
              src={shownSrc}
              alt={item.title}
              onError={() => {
                if (!mediaFailed) setFailedUrl(url);
                else onClose();
              }}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          ) : (
            <div className="max-w-md rounded-2xl border border-white/10 bg-black/60 p-8 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-[#FFBE4A]" />
              <p className="mt-2 font-bold text-white">Upstream blocked the full image</p>
              <p className="mt-1 text-[13px] text-white/60">
                This source refused the full-size file. Try the Details page or open it at the source.
              </p>
            </div>
          )}
        </div>

        {/* tag sidebar — click any tag to search it */}
        <aside className="max-h-[38vh] shrink-0 overflow-y-auto border-t border-white/10 bg-[#0B0F1A]/95 p-4 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          {groups.map((g) => (
            <div key={g.label} className="mb-4">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: g.color }}>{g.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => onTagClick(t)}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11.5px] font-semibold text-white/85 transition-colors hover:bg-white/15"
                    style={{ borderColor: `${g.color}44` }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {general.length > 0 && (
            <div className="mb-2">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {general.slice(0, 30).map((t) => (
                  <button
                    key={t}
                    onClick={() => onTagClick(t)}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11.5px] font-semibold text-white/70 transition-colors hover:bg-white/15"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {item.description && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50">Description</p>
              <p className="line-clamp-6 text-[12px] leading-relaxed text-white/60">{item.description}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
