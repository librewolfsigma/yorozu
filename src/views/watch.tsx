"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize2, Loader2,
  AlertTriangle, ChevronLeft, ChevronRight, ShieldCheck,
} from "lucide-react";
import { api, post } from "@/lib/client-api";
import { navigate } from "@/hooks/use-hash-route";
import { useAuth } from "@/components/providers";
import { categoryMeta, fmtDuration } from "@/lib/category-meta";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface EpisodePayload {
  id: string;
  media: { id: string; slug: string; title: string; category: string; accent: string | null };
  number: number;
  title: string | null;
  durationSec: number | null;
  streamUrl: string | null;
  streamType: string | null;
  summary: string | null;
  siblings: { id: string; number: number; title: string | null }[];
}

export default function WatchView({ slug, episodeId }: { slug?: string; episodeId?: string }) {
  const { user, demoLogin } = useAuth();
  const qc = useQueryClient();
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSyncRef = useRef(0);

  const { data: ep, isLoading, isError } = useQuery({
    queryKey: ["episode", episodeId],
    queryFn: () => api<EpisodePayload>(`/api/episodes/${episodeId}`),
    enabled: !!episodeId,
  });

  const { data: detail } = useQuery({
    queryKey: ["media", slug],
    queryFn: () => api<{ media: { id: string; slug: string; title: string; category: string; accent: string | null }; episodes: { id: string; number: number }[]; library: { status: string; progress: number } | null }>(`/api/media/${slug}`),
    enabled: !!slug,
  });

  const meta = ep ? categoryMeta(ep.media.category) : categoryMeta("ANIME");
  const hub = ep?.media.accent ?? meta.hub;

  const sync = useMutation({
    mutationFn: (payload: { positionSec: number; completed: boolean }) =>
      post("/api/progress", {
        mediaId: ep?.media.id,
        itemId: ep?.id,
        kind: "EPISODE",
        positionSec: Math.floor(payload.positionSec),
        completed: payload.completed,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media", slug] }),
  });

  // periodic progress sync every 10s while playing
  useEffect(() => {
    if (!user || !ep) return;
    const t = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused && v.duration > 0) {
        sync.mutate({ positionSec: v.currentTime, completed: v.currentTime / v.duration > 0.9 });
      }
    }, 10_000);
    return () => clearInterval(t);
  }, [user, ep]);

  // on unmount / episode change, save final position
  useEffect(() => {
    const v = videoRef.current;
    return () => {
      if (user && ep && v && v.duration > 0) {
        void post("/api/progress", {
          mediaId: ep.media.id, itemId: ep.id, kind: "EPISODE",
          positionSec: Math.floor(v.currentTime), completed: v.currentTime / v.duration > 0.9,
        }).catch(() => {});
      }
    };
  }, [user, ep]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const idx = ep ? ep.siblings.findIndex((s) => s.id === ep.id) : -1;
  const prevEp = idx > 0 ? ep!.siblings[idx - 1] : null;
  const nextEp = ep && idx >= 0 && idx < ep.siblings.length - 1 ? ep.siblings[idx + 1] : null;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080f19]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF6F91]" />
      </div>
    );
  }
  if (isError || !ep) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#080f19]">
        <AlertTriangle className="h-8 w-8 text-[#EF5B6B]" />
        <p className="font-semibold">Episode not found</p>
        <Button variant="outline" onClick={() => navigate(`/media/${slug}`)}>Back to details</Button>
      </div>
    );
  }

  const hasStream = !!ep.streamUrl;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#080f19]" style={{ ["--hub" as string]: hub }}>
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-[#0B1622]/95 px-3 backdrop-blur">
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground" onClick={() => navigate(`/media/${slug}`)}>
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{ep.media.title}</span>
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[13px] font-bold text-white">
            {ep.media.category === "AV" ? "Scene" : "Episode"} {ep.number} — {ep.title}
          </p>
          <p className="text-[11px] text-muted-foreground">{fmtDuration(ep.durationSec)}</p>
        </div>
        <span className="hidden rounded-full bg-[#3BD47A]/15 px-2.5 py-1 text-[10px] font-bold text-[#3BD47A] sm:inline-flex sm:items-center sm:gap-1">
          <ShieldCheck className="h-3 w-3" /> Verified 18+ performers
        </span>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* player */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center bg-black p-0 lg:p-6">
            {hasStream ? (
              <video
                ref={videoRef}
                src={ep.streamUrl!}
                controls
                autoPlay
                muted={muted}
                playsInline
                className="max-h-full max-w-full"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => user && sync.mutate({ positionSec: duration, completed: true })}
              />
            ) : (
              <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center m-6">
                <AlertTriangle className="mx-auto h-9 w-9 text-[#FFBE4A]" />
                <p className="mt-3 font-bold">No authorized stream available</p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  The installed providers for this title don&apos;t include a licensed stream in this
                  demo environment. Yozora never circumvents provider access controls, DRM or
                  regional restrictions — when a provider grants streams, they play right here.
                </p>
                <div className="mt-4 rounded-lg bg-muted/60 p-3 text-left text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground/80">Provider status:</p>
                  <p className="mt-1">Adapter OK · stream manifest intentionally empty (demo licensing)</p>
                </div>
                {!user && (
                  <Button className="mt-4 rounded-xl border-0 text-[#04121E]" style={{ background: hub }} onClick={() => void demoLogin()}>
                    Sign in as demo
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* custom controls (only when streaming) */}
          {hasStream && (
            <div className="flex items-center gap-3 border-t border-border/70 bg-[#0B1622]/95 px-4 py-3">
              <button onClick={togglePlay} className="flex h-10 w-10 items-center justify-center rounded-full text-[#04121E]" style={{ background: hub }} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="h-4.5 w-4.5 fill-current" /> : <Play className="h-4.5 w-4.5 fill-current" />}
              </button>
              <button onClick={() => { setMuted((m) => !m); if (videoRef.current) videoRef.current.muted = !muted; }} className="text-muted-foreground hover:text-foreground" aria-label={muted ? "Unmute" : "Mute"}>
                {muted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
              </button>
              <span className="w-24 text-xs tabular-nums text-muted-foreground">
                {fmtDuration(Math.floor(position))} / {fmtDuration(Math.floor(duration || ep.durationSec || 0))}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#23324A]">
                <div className="h-full rounded-full transition-all" style={{ width: duration ? `${(position / duration) * 100}%` : "0%", background: hub }} />
              </div>
              <button
                onClick={() => videoRef.current && (videoRef.current.requestFullscreen?.())}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fullscreen"
              >
                <Maximize2 className="h-4.5 w-4.5" />
              </button>
            </div>
          )}

          {/* summary */}
          <div className="border-t border-border/70 p-4">
            {ep.summary && <p className="text-[13px] leading-relaxed text-muted-foreground">{ep.summary}</p>}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-2">
                {prevEp && (
                  <Button variant="outline" size="sm" className="gap-1 rounded-lg border-border" onClick={() => navigate(`/watch/${slug}/${prevEp.id}`)}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Scene {prevEp.number}
                  </Button>
                )}
                {nextEp && (
                  <Button size="sm" className="gap-1 rounded-lg border-0 text-[#04121E]" style={{ background: hub }} onClick={() => navigate(`/watch/${slug}/${nextEp.id}`)}>
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {user && (
                <button
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  onClick={() => void sync.mutateAsync({ positionSec: Math.floor(position), completed: true }).then(() => toast.success("Marked as watched"))}
                >
                  Mark as watched
                </button>
              )}
            </div>
          </div>
        </div>

        {/* episode sidebar */}
        <aside className={cn("w-full shrink-0 border-t border-border/70 bg-[#0B1622]/60 lg:w-80 lg:border-l lg:border-t-0", "max-h-72 overflow-y-auto lg:max-h-none")}>
          <p className="sticky top-0 bg-[#0B1622]/95 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground backdrop-blur">
            All {ep.media.category === "AV" ? "scenes" : "episodes"} ({ep.siblings.length})
          </p>
          <div className="space-y-1 px-2 pb-4">
            {ep.siblings.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/watch/${slug}/${s.id}`)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[13px] transition-colors",
                  s.id === ep.id ? "hub-soft font-bold" : "hover:bg-white/5"
                )}
              >
                <span className="w-8 shrink-0 text-center text-xs font-bold" style={{ color: hub }}>{s.number}</span>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                {s.id === ep.id && <Play className="h-3.5 w-3.5 shrink-0" style={{ color: hub }} />}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
