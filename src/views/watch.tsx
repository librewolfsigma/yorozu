"use client";

// Cinema view — plays one episode resolved live from /api/work.
// Playback stack: direct MP4 via <video>, HLS (.m3u8) via hls.js.
// If the provider serves no stream — or the stream fails (expired token,
// bot-challenge, geo) — this view says so honestly and links out.
// It never renders a fake player and never crashes on a dead src
// (docs/CLIENT_ARCHITECTURE.md §5).

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize2,
  AlertTriangle, ChevronLeft, ChevronRight, Loader2, RotateCcw,
} from "lucide-react";
import { api, post } from "@/lib/client-api";
import { navigate } from "@/hooks/use-hash-route";
import { useAuth } from "@/components/providers";
import { categoryMeta, fmtDuration } from "@/lib/category-meta";
import { ProviderChips } from "@/components/media/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { WorkDTO } from "@/lib/serialize";

interface EpisodeUnit {
  key: string; number: number; title: string | null; thumbnailUrl: string | null;
  durationSec: number | null; streamUrl: string | null; streamType: string | null; summary: string | null;
}
interface ProviderInfo {
  id: string; name: string; status: string;
  configRequired?: boolean;
  availability?: { watch: boolean; read: boolean; view: boolean };
}
interface WorkDetail {
  work: WorkDTO;
  units: { episodes: EpisodeUnit[]; chapters: { key: string }[]; images: { url: string }[] };
  provider: ProviderInfo;
  ref: string;
}

/** Fire-and-forget progress POST — Yozora has no login; the local profile always accepts it. */
export function reportProgress(payload: Record<string, unknown>): void {
  void post("/api/progress", payload).catch(() => {
    /* offline — progress is best-effort, never noisy */
  });
}

export default function WatchView({ provider, id, episodeKey }: { provider?: string | null; id?: string | null; episodeKey?: string | null }) {
  const { user } = useAuth();
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);

  // ── mid-stream resilience ──────────────────────────────────────────────
  // Tube-site stream tokens are short-lived and IP-locked; a stream that
  // dies MID-VIDEO (stall/expired token/egress IP rotation) is recovered
  // automatically: save the playback position, force a genuinely FRESH
  // upstream resolve (fresh=1 skips the units cache), remount the player
  // and resume at the saved position. Max 2 auto attempts, then the
  // honest manual panel takes over.
  const [freshTick, setFreshTick] = useState(0);
  const [autoRetries, setAutoRetries] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const resumeAtRef = useRef(0);
  const lastPosRef = useRef(0);
  const lastProgressAtRef = useRef(Date.now());
  const recoveringRef = useRef(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["work", provider, id, freshTick],
    queryFn: () =>
      api<WorkDetail>(
        `/api/work?p=${encodeURIComponent(provider!)}&id=${encodeURIComponent(id!)}${freshTick > 0 ? "&fresh=1" : ""}`,
      ),
    enabled: !!provider && !!id,
  });

  const work = data?.work ?? null;
  const episodes = data?.units.episodes ?? [];
  const ep = episodes.find((e) => e.key === episodeKey) ?? episodes[0] ?? null;
  const meta = work ? categoryMeta(work.category) : categoryMeta("ANIME");
  const hub = work?.accent || meta.hub;
  const isAV = work?.category === "AV";
  const backHref = provider && id ? `/media?p=${encodeURIComponent(provider)}&id=${encodeURIComponent(id)}` : "/";

  // Reset player state when the episode (and therefore the src) changes.
  useEffect(() => {
    setVideoError(false);
    setBuffering(true);
    setPosition(0);
    setDuration(0);
    setAutoRetries(0);
    setReconnecting(false);
    resumeAtRef.current = 0;
    recoveringRef.current = false;
    lastProgressAtRef.current = Date.now();
  }, [ep?.key]);

  // After a fresh resolve lands, resume playback at the saved position.
  useEffect(() => {
    if (reconnecting && data?.units.episodes.length) {
      setReconnecting(false);
      recoveringRef.current = false;
      // resumeAtRef is consumed by onLoadedMetadata when the remounted video
      // is ready — nothing else to do here.
    }
  }, [reconnecting, data]);

  // Tear down any hls.js instance on unmount / src change.
  useEffect(() => {
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [ep?.key, ep?.streamUrl]);

  const syncNow = useCallback(
    (positionSec: number, completed = false) => {
      if (!user || !work || !ep) return;
      reportProgress({
        provider: work.provider, externalId: work.externalId, category: work.category,
        title: work.title, cover: work.coverUrl ?? undefined,
        kind: "EPISODE", unitKey: ep.key, unitLabel: isAV ? `Scene ${ep.number}` : `Episode ${ep.number}`,
        positionSec: Math.floor(positionSec), completed,
      });
    },
    [user, work, ep, isAV]
  );

  // periodic progress sync every 10s while playing
  useEffect(() => {
    if (!user || !ep) return;
    const t = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused && v.duration > 0) {
        syncNow(v.currentTime, v.currentTime / v.duration > 0.9);
      }
    }, 10_000);
    return () => clearInterval(t);
  }, [user, ep, syncNow]);

  // latest sync function without re-arming the save-on-unmount effect
  const syncNowRef = useRef(syncNow);
  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  // on unmount / episode change, save the final position (captures THIS episode's
  // video element + unit, so the position lands on the right unitKey)
  useEffect(() => {
    const v = videoRef.current;
    const epAtMount = ep;
    return () => {
      if (epAtMount && v && v.duration > 0) {
        syncNowRef.current(v.currentTime, v.currentTime / v.duration > 0.9);
      }
    };
  }, [user, ep]);

  /**
   * Stream failure recovery — the heart of mid-video resilience.
   * If playback had already progressed, DON'T just show an error panel:
   * force a fresh resolve (new token, new IP binding) and resume.
   */
  const handleStreamFailure = useCallback(
    (_reason: string) => {
      if (recoveringRef.current) return;
      const v = videoRef.current;
      const saved = v && v.currentTime > 2 ? v.currentTime : lastPosRef.current;
      if (autoRetries < 2) {
        recoveringRef.current = true;
        setAutoRetries((n) => n + 1);
        resumeAtRef.current = saved;
        setVideoError(false);
        setBuffering(true);
        setReconnecting(true);
        lastProgressAtRef.current = Date.now();
        toast("Stream interrupted — resolving a fresh stream…", {
          description: saved > 2 ? `Will resume at ${fmtDuration(Math.floor(saved))}` : undefined,
        });
        setFreshTick((t) => t + 1);
      } else {
        setVideoError(true);
        setReconnecting(false);
      }
    },
    [autoRetries],
  );

  // Stall watchdog: while playing, if the position has not advanced for 20s
  // (and we are not already recovering), treat it as a dead stream.
  useEffect(() => {
    const t = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || videoError || recoveringRef.current) return;
      if (v.duration > 0 && Date.now() - lastProgressAtRef.current > 20_000) {
        handleStreamFailure("stream stalled");
      }
    }, 5_000);
    return () => clearInterval(t);
  }, [videoError, handleStreamFailure]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || videoError) return;
    if (v.paused) {
      // play() rejects with NotSupportedError when the src is dead/wrong —
      // surface the honest error panel instead of an uncaught exception.
      v.play().catch(() => handleStreamFailure("player refused the stream"));
    } else {
      v.pause();
    }
  }, [videoError, handleStreamFailure]);

  // Attach hls.js when the stream is HLS (browsers other than Safari cannot
  // play .m3u8 natively). Direct mp4 just uses the src attribute.
  useEffect(() => {
    const v = videoRef.current;
    const url = ep?.streamUrl;
    if (!v || !url) return;
    if (v.canPlayType("application/vnd.apple.mpegurl") && url.includes(".m3u8")) {
      v.src = url; // Safari native HLS
      return;
    }
    if (!url.includes(".m3u8")) return; // plain mp4 — src attribute handles it
    let cancelled = false;
    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !videoRef.current) return;
      if (!Hls.isSupported()) {
        setVideoError(true);
        return;
      }
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) handleStreamFailure(`hls: ${data.details ?? "fatal error"}`);
      });
    });
    return () => { cancelled = true; };
  }, [ep?.key, ep?.streamUrl]);

  const retryStream = useCallback(() => {
    // Manual fresh resolve: drop everything, force a genuinely new upstream
    // resolve (fresh=1), and remount. Same recovery path as the automatic one.
    setAutoRetries(0);
    recoveringRef.current = false;
    resumeAtRef.current = videoRef.current?.currentTime ?? 0;
    handleStreamFailure("manual retry");
  }, [handleStreamFailure]);

  const enc = encodeURIComponent;
  const watchHref = (key: string) => `/watch?p=${enc(provider!)}&id=${enc(id!)}&ep=${enc(key)}`;
  const idx = ep ? episodes.findIndex((e) => e.key === ep.key) : -1;
  const prevEp = idx > 0 ? episodes[idx - 1] : null;
  const nextEp = ep && idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1] : null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col gap-4 bg-[#080f19] p-4">
        <div className="yz-skeleton h-10 rounded-xl" />
        <div className="yz-skeleton flex-1 rounded-2xl" />
      </div>
    );
  }
  if (isError || !data || !work) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-[#080f19]">
        <AlertTriangle className="h-8 w-8 text-[#EF5B6B]" />
        <p className="font-semibold">Could not open this episode</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">{(error as Error)?.message ?? "The provider may be unreachable right now."}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetch()}>Retry</Button>
          <Button variant="ghost" onClick={() => navigate(backHref)}>Back to details</Button>
        </div>
      </div>
    );
  }
  if (!ep) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-[#080f19] px-4">
        <AlertTriangle className="h-8 w-8 text-[#FFBE4A]" />
        <p className="font-semibold">This source exposes no playable episodes</p>
        {work.externalLinks.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {work.externalLinks.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[13px] font-bold" style={{ borderColor: `${hub}44`, background: `${hub}14`, color: hub }}>
                <ArrowLeft className="hidden h-3.5 w-3.5" /> {l.label}
              </a>
            ))}
          </div>
        )}
        <Button variant="ghost" onClick={() => navigate(backHref)}>← Back to details</Button>
      </div>
    );
  }

  const hasStream = !!ep.streamUrl;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#080f19]" style={{ ["--hub" as string]: hub }}>
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/95 px-3 backdrop-blur">
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground" onClick={() => navigate(backHref)}>
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{work.title}</span>
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[13px] font-bold text-white">
            {isAV ? "Scene" : "Episode"} {ep.number} — {ep.title ?? (isAV ? "Scene" : "Episode")}
          </p>
          <p className="text-[11px] text-muted-foreground">{fmtDuration(ep.durationSec)} · via {work.providerName}</p>
        </div>
        <span className="hidden rounded-full bg-card px-2.5 py-1 text-[10px] font-bold text-muted-foreground sm:inline-flex sm:items-center">
          {work.providerName}
        </span>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* player */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center bg-black p-0 lg:p-6">
            {hasStream && !videoError ? (
              <div className="relative w-full" style={{ maxHeight: "70vh" }}>
                <video
                  key={`${ep.key}:${autoRetries}:${freshTick}`}
                  ref={videoRef}
                  src={ep.streamType === "hls" ? undefined : ep.streamUrl!}
                  controls
                  autoPlay
                  muted={muted}
                  playsInline
                  poster={ep.thumbnailUrl ?? work.coverUrl ?? undefined}
                  className="mx-auto w-full"
                  style={{ maxHeight: "70vh" }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={(e) => {
                    setPosition(e.currentTarget.currentTime);
                    lastPosRef.current = e.currentTarget.currentTime;
                    lastProgressAtRef.current = Date.now();
                  }}
                  onLoadedMetadata={(e) => {
                    setDuration(e.currentTarget.duration);
                    setBuffering(false);
                    const v = e.currentTarget;
                    if (resumeAtRef.current > 2 && Number.isFinite(v.duration)) {
                      v.currentTime = Math.min(resumeAtRef.current, Math.max(0, v.duration - 5));
                      toast.success(`Resumed at ${fmtDuration(Math.floor(resumeAtRef.current))}`);
                      resumeAtRef.current = 0;
                    }
                  }}
                  onWaiting={() => setBuffering(true)}
                  onPlaying={() => { setBuffering(false); setVideoError(false); }}
                  onCanPlay={() => setBuffering(false)}
                  onError={() => handleStreamFailure("media error")}
                  onEnded={() => syncNow(duration || ep.durationSec || 0, true)}
                />
                {buffering && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-white/70" />
                  </div>
                )}
                {reconnecting && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center">
                    <span className="flex items-center gap-2 rounded-full bg-black/75 px-4 py-1.5 text-[12px] font-bold text-white backdrop-blur">
                      <RotateCcw className="h-3.5 w-3.5 animate-spin" /> Recovering stream — fetching a fresh link
                    </span>
                  </div>
                )}
              </div>
            ) : hasStream && videoError ? (
              /* stream failed — expired token / bot challenge / dead CDN link.
               Auto-recovery already tried twice; this panel offers the manual path. */
              <div className="mx-auto m-6 max-w-md rounded-2xl border border-border bg-card p-6 text-center">
                <AlertTriangle className="mx-auto h-9 w-9 text-[#EF5B6B]" />
                <p className="mt-3 font-bold">This stream could not be played</p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  Automatic recovery already re-resolved the stream {autoRetries} time{autoRetries === 1 ? "" : "s"}. The link {work.providerName} served may keep expiring — a fresh resolve usually fixes it, or the video may be temporarily unavailable upstream.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button size="sm" className="rounded-lg text-primary-foreground" style={{ background: hub }} onClick={retryStream}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Try a fresh resolve
                  </Button>
                  {work.externalLinks.length > 0 && (
                    <a
                      href={work.externalLinks[0].url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex h-9 items-center rounded-lg border px-4 text-[13px] font-bold"
                      style={{ borderColor: `${hub}44`, background: `${hub}14`, color: hub }}
                    >
                      Open at source
                    </a>
                  )}
                </div>
              </div>
            ) : (
              /* honest panel — never a fake player */
              <div className="mx-auto m-6 max-w-md rounded-2xl border border-border bg-card p-6 text-center">
                <AlertTriangle className="mx-auto h-9 w-9 text-[#FFBE4A]" />
                <p className="mt-3 font-bold">No in-app stream for this source</p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {work.providerName} does not serve a stream that Yozora can play. Yozora never circumvents
                  provider access controls, DRM or regional restrictions — when a provider grants streams,
                  they play right here.
                </p>
                {work.externalLinks.length > 0 && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {work.externalLinks.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[13px] font-bold"
                        style={{ borderColor: `${hub}44`, background: `${hub}14`, color: hub }}
                      >
                        <ChevronRight className="h-3.5 w-3.5" /> {l.label}
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <ProviderChips provider={{ ...data.provider, externalUrl: work.externalUrl }} />
                </div>
              </div>
            )}
          </div>

          {/* custom controls (only when streaming successfully) */}
          {hasStream && !videoError && (
            <div className="flex items-center gap-3 border-t border-border/70 bg-background/95 px-4 py-3">
              <button onClick={togglePlay} className="flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground" style={{ background: hub }} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="h-4.5 w-4.5 fill-current" /> : <Play className="h-4.5 w-4.5 fill-current" />}
              </button>
              <button onClick={() => { setMuted((m) => !m); if (videoRef.current) videoRef.current.muted = !muted; }} className="text-muted-foreground hover:text-foreground" aria-label={muted ? "Unmute" : "Mute"}>
                {muted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
              </button>
              <span className="w-24 text-xs tabular-nums text-muted-foreground">
                {fmtDuration(Math.floor(position))} / {fmtDuration(Math.floor(duration || ep.durationSec || 0))}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#34353E]">
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
                  <Button variant="outline" size="sm" className="gap-1 rounded-lg border-border" onClick={() => navigate(watchHref(prevEp.key))}>
                    <ChevronLeft className="h-3.5 w-3.5" /> {isAV ? "Scene" : "Ep."} {prevEp.number}
                  </Button>
                )}
                {nextEp && (
                  <Button size="sm" className="gap-1 rounded-lg border-0 text-primary-foreground" style={{ background: hub }} onClick={() => navigate(watchHref(nextEp.key))}>
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <button
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                onClick={() => { syncNow(position, true); toast.success("Marked as watched"); }}
              >
                Mark as watched
              </button>
            </div>
          </div>
        </div>

        {/* episode sidebar */}
        <aside className={cn("w-full shrink-0 border-t border-border/70 bg-background/60 lg:w-80 lg:border-l lg:border-t-0", "max-h-72 overflow-y-auto lg:max-h-none")}>
          <p className="sticky top-0 bg-background/95 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground backdrop-blur">
            All {isAV ? "scenes" : "episodes"} ({episodes.length})
          </p>
          <div className="space-y-1 px-2 pb-4">
            {episodes.map((e) => (
              <button
                key={e.key}
                onClick={() => navigate(watchHref(e.key))}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[13px] transition-colors",
                  e.key === ep.key ? "hub-soft font-bold" : "hover:bg-white/5"
                )}
              >
                <span className="w-8 shrink-0 text-center text-xs font-bold" style={{ color: hub }}>{e.number}</span>
                <span className="min-w-0 flex-1 truncate">{e.title ?? (isAV ? "Scene" : "Episode")}</span>
                {!e.streamUrl && <span className="shrink-0 text-[9px] font-bold uppercase text-muted-foreground">ext</span>}
                {e.key === ep.key && <Play className="h-3.5 w-3.5 shrink-0" style={{ color: hub }} />}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
