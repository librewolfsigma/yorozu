"use client";

// Illustration viewer — masonry grid + zoomable lightbox over images served
// live by the provider (/api/work). All artwork stays attributed to its
// source; Yozora hosts nothing and favorites are the user's own data.

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, X, ChevronLeft, ChevronRight, ExternalLink, ZoomIn, AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { navigate } from "@/hooks/use-hash-route";
import { useAuth } from "@/components/providers";
import { categoryMeta } from "@/lib/category-meta";
import { FavoriteButton } from "@/components/media/actions";
import { reportProgress } from "@/views/watch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WorkDTO, WorkRefInfo } from "@/lib/serialize";

interface GalleryImage { url: string; thumbUrl: string | null; width: number; height: number; tags: string[]; }
interface WorkDetail {
  work: WorkDTO;
  units: { episodes: { key: string }[]; chapters: { key: string }[]; images: GalleryImage[] };
  library: { favorite: boolean } | null;
  ref: string;
}

export default function GalleryView({ provider, id }: { provider?: string | null; id?: string | null }) {
  const { user } = useAuth();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const lastSyncRef = useRef<number | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["work", provider, id],
    queryFn: () => api<WorkDetail>(`/api/work?p=${encodeURIComponent(provider!)}&id=${encodeURIComponent(id!)}`),
    enabled: !!provider && !!id,
  });

  const work = data?.work ?? null;
  const images = data?.units.images ?? [];
  const meta = work ? categoryMeta(work.category) : categoryMeta("ILLUSTRATION");
  const hub = work?.accent || meta.hub;
  const backHref = provider && id ? `/media?p=${encodeURIComponent(provider)}&id=${encodeURIComponent(id)}` : "/";

  // track which image the visitor is looking at (kind GALLERY, unitKey "gallery")
  useEffect(() => {
    if (!user || lightbox === null || !work) return;
    if (lastSyncRef.current === lightbox) return;
    lastSyncRef.current = lightbox;
    reportProgress({
      provider: work.provider, externalId: work.externalId, category: work.category,
      title: work.title, cover: work.coverUrl ?? undefined,
      kind: "GALLERY", unitKey: "gallery", pageIndex: lightbox,
    });
  }, [user, lightbox, work]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col gap-3 bg-[#080f19] p-4">
        <div className="yz-skeleton h-10 rounded-xl" />
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="yz-skeleton break-inside-avoid rounded-xl" style={{ height: `${180 + ((i * 53) % 140)}px` }} />
          ))}
        </div>
      </div>
    );
  }
  if (isError || !data || !work) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-[#080f19] px-4">
        <AlertTriangle className="h-8 w-8 text-[#EF5B6B]" />
        <p className="font-semibold">Could not open this gallery</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">{(error as Error)?.message ?? "The provider may be unreachable right now."}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetch()}>Retry</Button>
          <Button variant="ghost" onClick={() => navigate(backHref)}>Back to details</Button>
        </div>
      </div>
    );
  }

  const refInfo: WorkRefInfo = {
    provider: work.provider, externalId: work.externalId,
    category: work.category, title: work.title, coverUrl: work.coverUrl,
  };
  const current = lightbox !== null ? images[lightbox] : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#080f19]" style={{ ["--hub" as string]: hub }}>
      {/* header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-[#0B1622]/95 px-3 backdrop-blur">
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground" onClick={() => navigate(backHref)}>
          <ArrowLeft className="h-4 w-4" /> <span className="hidden truncate sm:inline">{work.title}</span>
        </Button>
        <div className="flex-1 text-center">
          <p className="text-[13px] font-bold text-white">{images.length} images</p>
        </div>
        {work.creator && (
          <span className="hidden rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-block" style={{ background: `${hub}1a`, color: hub }}>
            by {work.creator}
          </span>
        )}
        <FavoriteButton work={refInfo} favorite={data.library?.favorite ?? false} hub={hub} />
      </header>

      {/* masonry grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-[#FFBE4A]" />
            <p className="font-semibold">This source exposes no images to view in-app</p>
            {work.externalLinks.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {work.externalLinks.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[13px] font-bold" style={{ borderColor: `${hub}44`, background: `${hub}14`, color: hub }}>
                    <ExternalLink className="h-3.5 w-3.5" /> {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
              {images.map((g, i) => (
                <div
                  key={g.url}
                  className="group relative break-inside-avoid overflow-hidden rounded-xl card-ring"
                  onClick={() => {
                    setLightbox(i);
                    setZoom(1);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setLightbox(i)}
                >
                  <img src={g.thumbUrl ?? g.url} alt={`Artwork ${i + 1}`} loading="lazy" className="w-full cursor-zoom-in transition-transform duration-500 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex flex-wrap gap-1">
                      {g.tags.slice(0, 2).map((t, ti) => (
                        <span key={`${t}-${ti}`} className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="py-4 text-center text-[11px] text-muted-foreground">
              Served by {work.providerName} — all artwork belongs to its original creators.
            </p>
          </>
        )}
      </div>

      {/* lightbox */}
      <AnimatePresence>
        {current && (
          <motion.div
            className="fixed inset-0 z-[70] flex flex-col bg-black/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <div className="flex h-14 shrink-0 items-center justify-between px-4" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-bold text-white">
                {lightbox! + 1} <span className="text-muted-foreground">/ {images.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:text-white"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Open original image at the source"
                >
                  <ExternalLink className="h-4 w-4" /> Original
                </a>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-white"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4.5 w-4.5" />
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-white" onClick={() => setLightbox(null)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-between gap-2 px-2 pb-4">
              <button
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoom(1);
                  setLightbox((l) => (l! > 0 ? l! - 1 : images.length - 1));
                }}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <motion.img
                key={current.url}
                src={current.url}
                alt={`Artwork ${lightbox! + 1}`}
                className="max-h-full max-w-[85%] rounded-xl object-contain shadow-2xl"
                style={{ transform: `scale(${zoom})` }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: zoom }}
                transition={{ duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoom(1);
                  setLightbox((l) => (l! < images.length - 1 ? l! + 1 : 0));
                }}
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="shrink-0 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-1.5">
                {current.tags.map((t, ti) => (
                  <Badge key={`${t}-${ti}`} variant="secondary" className="rounded-full bg-white/10 text-white/80">{t}</Badge>
                ))}
              </div>
              <p className={cn("mt-2 text-center text-[11px] text-muted-foreground")}>
                Served by {work.providerName} — attributed to the original creator.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
