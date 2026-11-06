"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, X, ChevronLeft, ChevronRight, Heart, Download, ZoomIn, Loader2,
} from "lucide-react";
import { api, post } from "@/lib/client-api";
import { navigate } from "@/hooks/use-hash-route";
import { useAuth } from "@/components/providers";
import { categoryMeta } from "@/lib/category-meta";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface GalleryPayload {
  media: { id: string; slug: string; title: string; category: string; accent: string | null; creator: string | null };
  gallery: { id: string; idx: number; imageUrl: string; thumbUrl: string | null; width: number; height: number; tags: string[]; favCount: number }[];
}

export default function GalleryView({ slug }: { slug?: string }) {
  const { user, demoLogin } = useAuth();
  const qc = useQueryClient();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [favSet, setFavSet] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["media", slug],
    queryFn: () => api<GalleryPayload>(`/api/media/${slug}`),
    enabled: !!slug,
  });

  const meta = data ? categoryMeta(data.media.category) : categoryMeta("ILLUSTRATION");
  const hub = data?.media.accent ?? meta.hub;

  const fav = useMutation({
    mutationFn: (imageId: string) => post(`/api/gallery-fav/${imageId}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleFav = (imageId: string) => {
    if (!user) {
      toast.error("Sign in to favorite images", { description: "Use the demo login from the header." });
      return;
    }
    setFavSet((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
    fav.mutate(imageId);
  };

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080f19]">
        <Loader2 className="h-8 w-8 animate-spin text-[#AE8BFF]" />
      </div>
    );
  }

  const images = data.gallery;
  const current = lightbox !== null ? images[lightbox] : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#080f19]" style={{ ["--hub" as string]: hub }}>
      {/* header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-[#0B1622]/95 px-3 backdrop-blur">
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground" onClick={() => navigate(`/media/${slug}`)}>
          <ArrowLeft className="h-4 w-4" /> <span className="hidden truncate sm:inline">{data.media.title}</span>
        </Button>
        <div className="flex-1 text-center">
          <p className="text-[13px] font-bold text-white">{images.length} images</p>
        </div>
        {data.media.creator && (
          <span className="hidden rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-block" style={{ background: `${hub}1a`, color: hub }}>
            by {data.media.creator}
          </span>
        )}
      </header>

      {/* masonry grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
          {images.map((g, i) => (
            <div
              key={g.id}
              className="group relative break-inside-avoid overflow-hidden rounded-xl card-ring"
              onClick={() => {
                setLightbox(i);
                setZoom(1);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setLightbox(i)}
            >
              { }
              <img src={g.thumbUrl ?? g.imageUrl} alt={`Artwork ${i + 1}`} loading="lazy" className="w-full cursor-zoom-in transition-transform duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex flex-wrap gap-1">
                  {g.tags.slice(0, 2).map((t, ti) => (
                    <span key={`${t}-${ti}`} className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                      {t}
                    </span>
                  ))}
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-white">
                  <Heart className="h-3 w-3" /> {g.favCount + (favSet.has(g.id) ? 1 : 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
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
                <button
                  className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-colors", favSet.has(current.id) ? "text-[#FF6F91]" : "text-muted-foreground hover:text-white")}
                  onClick={() => toggleFav(current.id)}
                  aria-label="Favorite image"
                >
                  <Heart className={cn("h-4.5 w-4.5", favSet.has(current.id) && "fill-current")} />
                </button>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-white"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4.5 w-4.5" />
                </button>
                <a
                  href={current.imageUrl}
                  download
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-white"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Download image"
                >
                  <Download className="h-4.5 w-4.5" />
                </a>
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
                key={current.id}
                src={current.imageUrl}
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
              <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-1.5">
                {current.tags.map((t, ti) => (
                  <Badge key={`${t}-${ti}`} variant="secondary" className="rounded-full bg-white/10 text-white/80">{t}</Badge>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
