"use client";

import { Star, Play, Plus, Check, Image as ImageIcon } from "lucide-react";
import { categoryMeta, videoKindLabel, fmtNumber, STATUS_LABELS } from "@/lib/category-meta";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";
import type { WorkDTO } from "@/lib/serialize";

/** Card-level projection of a live WorkDTO — every list/rail/grid uses this. */
export interface MediaCardData {
  provider: string;
  externalId: string;
  ref: string;
  title: string;
  coverUrl: string | null;
  category: string;
  videoKind?: string | null;
  format?: string | null;
  status?: string | null;
  year?: number | null;
  rating?: number | null;
  popularity: number;
  genres?: string[];
  accent?: string | null;
}

export function fromDTO(m: WorkDTO): MediaCardData {
  return {
    provider: m.provider,
    externalId: m.externalId,
    ref: m.ref,
    title: m.title,
    coverUrl: m.coverUrl,
    category: m.category,
    videoKind: m.videoKind,
    format: m.format,
    status: m.status,
    year: m.year,
    rating: m.rating,
    popularity: m.popularity,
    genres: m.genres,
    accent: m.accent,
  };
}

/** Every external work is addressed by ?p=<provider>&id=<externalId>. */
export function workHref(provider: string, externalId: string): string {
  return `/media?p=${encodeURIComponent(provider)}&id=${encodeURIComponent(externalId)}`;
}

/**
 * Cover image that NEVER renders an empty src (a browser bug magnet: an
 * empty string src makes the page re-download itself). Renders a muted
 * placeholder block instead when there is no cover upstream.
 */
export function CoverImg({
  src, alt, className, iconClass,
}: { src?: string | null; alt: string; className?: string; iconClass?: string }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)} aria-hidden>
        <ImageIcon className={cn("h-5 w-5 text-muted-foreground", iconClass)} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={className} />;
}

export function MediaCard({
  media,
  width,
  showRank,
  rank,
  hubOverride,
  footer,
}: {
  media: MediaCardData;
  width?: number;
  showRank?: boolean;
  rank?: number;
  hubOverride?: string;
  footer?: React.ReactNode;
}) {
  const meta = categoryMeta(media.category);
  const hub = hubOverride ?? media.accent ?? meta.hub;
  return (
    <div
      className={`poster-card group cursor-pointer select-none ${width ? "shrink-0" : ""}`}
      style={width ? { width } : undefined}
      onClick={() => navigate(workHref(media.provider, media.externalId))}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(workHref(media.provider, media.externalId))}
      aria-label={`${media.title} (${meta.label})`}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-xl card-ring bg-[#141B30]"
        style={{ ["--hub" as string]: hub }}
      >
        {media.coverUrl ? (
          <img
            src={media.coverUrl}
            alt={`${media.title} cover`}
            loading="lazy"
            className="poster-img h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}

        {/* score badge */}
        {media.rating != null && media.rating > 0 && (
          <div className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-[#FFBE4A] backdrop-blur-sm">
            <Star className="h-3 w-3 fill-[#FFBE4A]" /> {media.rating.toFixed(1)}
          </div>
        )}

        {/* status badge */}
        {media.status && STATUS_LABELS[media.status] && (
          <div
            className="absolute right-1.5 top-1.5 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: "rgba(0,0,0,0.65)", color: hub }}
          >
            {STATUS_LABELS[media.status]}
          </div>
        )}

        {/* AV subcategory badge — AV/JAV/PMV/HMV/CREATOR stay distinct by design */}
        {media.videoKind && (
          <div className="absolute bottom-1.5 right-1.5 z-10 max-w-[92%] truncate rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            {videoKindLabel(media.videoKind)}
          </div>
        )}

        {/* rank */}
        {showRank && rank !== undefined && (
          <div className="absolute -left-1 bottom-1 z-10 font-display text-4xl leading-none text-white/90 [text-shadow:0_2px_10px_rgba(0,0,0,.8)]">
            {rank}
          </div>
        )}

        {/* hover overlay */}
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: hub, color: "#04121E" }}
          >
            <Play className="h-5 w-5 fill-current" />
          </div>
          {media.genres && media.genres.length > 0 && (
            <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
              {media.genres.slice(0, 3).map((g) => (
                <span key={g} className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <p className="line-clamp-1 text-[13px] font-semibold text-foreground/90 group-hover:text-white transition-colors">
          {media.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span style={{ color: hub }} className="font-semibold">{meta.label}</span>
          {media.year != null && <span>· {media.year}</span>}
          {media.format && <span>· {media.format}</span>}
        </p>
        {footer}
      </div>
    </div>
  );
}

export function MediaGrid({ items, className }: { items: MediaCardData[]; className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 ${className ?? ""}`}>
      {items.map((m) => (
        <MediaCard key={m.ref} media={m} />
      ))}
    </div>
  );
}

export function MediaRail({
  items,
  showRank,
  cardWidth = 150,
}: {
  items: MediaCardData[];
  showRank?: boolean;
  cardWidth?: number;
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x">
      {items.map((m, i) => (
        <div key={m.ref} className="snap-start">
          <MediaCard media={m} width={cardWidth} showRank={showRank} rank={i + 1} />
        </div>
      ))}
    </div>
  );
}

export function MediaCardSkeleton() {
  return (
    <div>
      <div className="yz-skeleton aspect-[2/3] rounded-xl" />
      <div className="yz-skeleton mt-2 h-3.5 w-4/5 rounded" />
      <div className="yz-skeleton mt-1.5 h-3 w-1/2 rounded" />
    </div>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <MediaCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PopularityBadge({ popularity }: { popularity: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Plus className="h-3 w-3" /> {fmtNumber(popularity)} adds
    </span>
  );
}

export function InLibraryDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="absolute left-1.5 bottom-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#3BD47A] text-black shadow">
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}
