"use client";

// Detail view — client-first: everything renders from the live /api/work
// payload (docs/CLIENT_ARCHITECTURE.md). No local metadata, no fake actions.
// Capability sections are honest: in-app units only when the provider serves them.

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Play, BookOpen, Image as ImageIcon, Info, Star, ShieldAlert,
  ExternalLink, PlayCircle, MessagesSquare, LayoutGrid, Puzzle, Zap, AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { categoryMeta, fmtDuration, STATUS_LABELS, fmtNumber, videoKindLabel } from "@/lib/category-meta";
import { MediaRail, fromDTO } from "@/components/media/card";
import {
  AddToLibraryButton, CollectionPicker, FavoriteButton, ReportDialog,
  ReviewSection, ProviderChips, type LibraryState,
} from "@/components/media/actions";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { WorkDTO, WorkRefInfo } from "@/lib/serialize";

// ── /api/work payload shapes (binding contract) ──
interface EpisodeUnit {
  key: string; number: number; title: string | null; thumbnailUrl: string | null;
  durationSec: number | null; streamUrl: string | null; streamType: string | null; summary: string | null;
}
interface ChapterUnit {
  key: string; number: number; title: string | null;
  pageCount: number | null; pages: string[] | null; resolveUrl: string | null;
}
interface GalleryImage { url: string; thumbUrl: string | null; width: number; height: number; tags: string[]; }
interface ReviewItem {
  id: string; score: number; title: string | null; body: string | null; createdAt: string;
  user: { username: string; displayName: string; avatarUrl: string | null }; isMine: boolean;
}
interface ProviderInfo {
  id: string; name: string; status: string;
  configRequired?: boolean;
  availability?: { watch: boolean; read: boolean; view: boolean };
}
interface WorkDetail {
  work: WorkDTO;
  units: { episodes: EpisodeUnit[]; chapters: ChapterUnit[]; images: GalleryImage[] };
  provider: ProviderInfo;
  popular: WorkDTO[];
  reviews: ReviewItem[];
  library: LibraryState | null;
  myCollections: { id: string; name: string; hasItem: boolean }[];
  detailError: string | null;
  ref: string;
}

export default function DetailView({ provider, id }: { provider?: string | null; id?: string | null }) {
  const [tab, setTab] = useState("overview");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["work", provider, id],
    queryFn: () => api<WorkDetail>(`/api/work?p=${encodeURIComponent(provider!)}&id=${encodeURIComponent(id!)}`),
    enabled: !!provider && !!id,
  });

  if (!provider || !id) {
    return (
      <div className="py-24 text-center">
        <p className="font-semibold">No title selected</p>
        <p className="mt-1 text-sm text-muted-foreground">Pick something from browse or search first.</p>
        <a href="#/browse/ANIME" className="mt-4 inline-block text-sm font-semibold text-[#3DB4F2] hover:underline">← Back to browse</a>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-6 py-2">
        <div className="yz-skeleton h-64 rounded-2xl" />
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="yz-skeleton aspect-[2/3] rounded-xl" />
              <div className="yz-skeleton mt-2 h-3.5 w-4/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="py-24 text-center">
        <p className="font-semibold">Could not load this title</p>
        <p className="mt-1 text-sm text-muted-foreground">{(error as Error)?.message ?? "The provider may be unreachable right now."}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button onClick={() => void refetch()} className="rounded-xl bg-[#3DB4F2]/15 px-4 py-2 text-sm font-bold text-[#3DB4F2]">Retry</button>
          <a href="#/browse/ANIME" className="rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">← Back to browse</a>
        </div>
      </div>
    );
  }

  const { work, units, provider: prov, detailError } = data;
  const meta = categoryMeta(work.category);
  const hub = work.accent || meta.hub;
  const Icon = meta.icon;

  const refInfo: WorkRefInfo = {
    provider: work.provider, externalId: work.externalId,
    category: work.category, title: work.title, coverUrl: work.coverUrl,
  };

  const hasUnits = units.episodes.length > 0 || units.chapters.length > 0 || units.images.length > 0;
  const unitsTab =
    units.episodes.length > 0 ? "episodes"
    : units.chapters.length > 0 ? "chapters"
    : units.images.length > 0 ? "gallery"
    : "about";

  const enc = encodeURIComponent;
  const firstUnitHref =
    unitsTab === "episodes" ? `/watch?p=${enc(work.provider)}&id=${enc(work.externalId)}&ep=${enc(units.episodes[0].key)}`
    : unitsTab === "chapters" ? `/read?p=${enc(work.provider)}&id=${enc(work.externalId)}&ch=${enc(units.chapters[0].key)}`
    : unitsTab === "gallery" ? `/gallery?p=${enc(work.provider)}&id=${enc(work.externalId)}`
    : null;

  const resumeLabel =
    work.category === "ANIME" ? "Watch now"
    : work.category === "AV" ? "Play now"
    : work.category === "MANGA" || work.category === "DOUJIN" || work.category === "MANHWA" ? "Read now"
    : work.category === "GALLERY" ? "Open collection"
    : work.category === "ILLUSTRATION" ? "View image"
    : meta.action;

  return (
    <div className="-mx-4 lg:-mx-5" style={{ ["--hub" as string]: hub }}>
      {/* metadata reliability — a failed details call never kills the page;
          identity + playable units stay servable and the error shows here */}
      {detailError && (
        <p className="mx-4 mt-4 flex items-start gap-1.5 rounded-lg border border-[#FFBE4A]/30 bg-[#FFBE4A]/10 p-3 text-xs text-foreground/85 lg:mx-5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFBE4A]" />
          <span>Partial metadata — {detailError} The title's playable units may still work; try again for full details.</span>
        </p>
      )}
      {/* ── Themed hero ── */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${hub}2e 0%, #101a2a 45%, #0B1622 100%)` }}
        />
        {(work.bannerUrl || work.coverUrl) && (
          <img src={(work.bannerUrl ?? work.coverUrl)!} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1622] via-transparent to-transparent" />

        <div className="relative mx-auto grid max-w-[1140px] gap-6 px-4 pb-6 pt-8 sm:grid-cols-[200px_1fr] sm:px-5 lg:px-5">
          <div className="mx-auto w-40 sm:mx-0 sm:w-full">
            {work.coverUrl ? (
              <img
                src={work.coverUrl}
                alt={`${work.title} cover`}
                className="aspect-[2/3] w-full rounded-2xl card-ring-lg object-cover"
              />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center rounded-2xl card-ring-lg bg-muted" aria-hidden>
                <Icon className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: `${hub}22`, color: hub }}>
                <Icon className="h-3.5 w-3.5" /> {meta.label}
              </span>
              {work.category === "AV" && work.videoKind && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${hub}1a`, color: hub }} title="Video subcategory — kept distinct by design (never merged into Anime)">
                  {videoKindLabel(work.videoKind)}
                </span>
              )}
              {work.format && <span className="text-xs text-muted-foreground">{work.format}</span>}
              {work.status && <span className="text-xs font-semibold" style={{ color: hub }}>{STATUS_LABELS[work.status] ?? work.status}</span>}
              {work.year && <span className="text-xs text-muted-foreground">· {work.year}</span>}
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                title={`Live from ${work.providerName}`}
              >
                <Puzzle className="h-3 w-3" style={{ color: hub }} /> via {work.providerName}
              </span>
            </div>

            <h1 className="mt-2.5 font-display text-3xl leading-tight text-white sm:text-4xl lg:text-5xl">{work.title}</h1>
            {work.altTitles.length > 0 && (
              <p className="mt-1 text-[13px] text-muted-foreground">Also known as: {work.altTitles.join(" · ")}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
              {work.rating !== null && (
                <span className="flex items-center gap-1 font-bold text-[#FFBE4A]">
                  <Star className="h-4 w-4 fill-[#FFBE4A]" /> {work.rating.toFixed(1)}
                </span>
              )}
              <span className="text-muted-foreground">{fmtNumber(work.popularity)} popularity</span>
              {work.studio && <span className="text-muted-foreground">Studio: <span className="text-foreground/90">{work.studio}</span></span>}
              {work.creator && <span className="text-muted-foreground">{work.category === "GAME" ? "Developer" : "Author"}: <span className="text-foreground/90">{work.creator}</span></span>}
            </div>

            {/* genres */}
            {work.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {work.genres.map((g) => (
                  <span key={g} className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold" style={{ borderColor: `${hub}44`, color: hub, background: `${hub}0d` }}>
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* actions */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {firstUnitHref ? (
                <button
                  onClick={() => navigate(firstUnitHref)}
                  className="flex h-12 items-center gap-2 rounded-2xl cta-gradient px-7 text-[15px] font-bold"
                >
                  <Play className="h-4.5 w-4.5 fill-current" /> {resumeLabel}
                </button>
              ) : work.externalLinks.length > 0 ? (
                <a href={work.externalLinks[0].url} target="_blank" rel="noopener noreferrer nofollow" className="flex h-12 items-center gap-2 rounded-2xl cta-gradient px-7 text-[15px] font-bold">
                  <ExternalLink className="h-4.5 w-4.5" /> Open on {work.providerName}
                </a>
              ) : (
                <button
                  onClick={() => navigate("/extensions")}
                  className="flex h-12 items-center gap-2 rounded-2xl cta-gradient px-7 text-[15px] font-bold"
                >
                  <Puzzle className="h-4.5 w-4.5" /> Get from a provider
                </button>
              )}
              <AddToLibraryButton work={refInfo} library={data.library} hub={hub} />
              <FavoriteButton work={refInfo} favorite={data.library?.favorite ?? false} hub={hub} />
              <CollectionPicker work={refInfo} hub={hub} collections={data.myCollections} />
              <ReportDialog targetType="WORK" targetId={data.ref} />
            </div>

            {/* provider config notice — honest about missing API keys */}
            {prov.configRequired && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#FFBE4A]/25 bg-[#FFBE4A]/10 p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#FFBE4A]" />
                <div className="text-[12.5px] leading-relaxed text-foreground/85">
                  <span className="font-bold text-[#FFBE4A]">Configuration needed: </span>
                  {work.providerName} needs your free API key before it can serve content.{" "}
                  <a href="#/extensions" className="font-semibold underline underline-offset-2" style={{ color: hub }}>
                    Configure it in Extensions
                  </a>
                  .
                </div>
              </div>
            )}

            <div className="mt-3">
              <ProviderChips provider={{ ...prov, externalUrl: work.externalUrl }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="mx-auto max-w-[1140px] px-4 pb-10 sm:px-5">
        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="mb-5 flex-wrap gap-1 rounded-xl bg-card p-1">
            <TabsTrigger value="overview" className="gap-1.5 rounded-lg"><Info className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            {units.episodes.length > 0 && <TabsTrigger value="episodes" className="gap-1.5 rounded-lg"><PlayCircle className="h-3.5 w-3.5" /> Episodes ({units.episodes.length})</TabsTrigger>}
            {units.chapters.length > 0 && <TabsTrigger value="chapters" className="gap-1.5 rounded-lg"><BookOpen className="h-3.5 w-3.5" /> Chapters ({units.chapters.length})</TabsTrigger>}
            {units.images.length > 0 && <TabsTrigger value="gallery" className="gap-1.5 rounded-lg"><ImageIcon className="h-3.5 w-3.5" /> Gallery ({units.images.length})</TabsTrigger>}
            <TabsTrigger value="reviews" className="gap-1.5 rounded-lg"><MessagesSquare className="h-3.5 w-3.5" /> Reviews ({data.reviews.length})</TabsTrigger>
            {data.popular.length > 0 && <TabsTrigger value="popular" className="gap-1.5 rounded-lg"><LayoutGrid className="h-3.5 w-3.5" /> Popular</TabsTrigger>}
          </TabsList>
        </Tabs>

        {tab === "overview" && <Overview data={data} hub={hub} hasUnits={hasUnits} />}
        {tab === "episodes" && <EpisodeList data={data} hub={hub} />}
        {tab === "chapters" && <ChapterList data={data} hub={hub} />}
        {tab === "gallery" && <GalleryPreview data={data} hub={hub} />}
        {tab === "reviews" && (
          <ReviewSection work={refInfo} reviews={data.reviews} hub={hub} rating={work.rating ?? 0} ratingCount={data.reviews.length} />
        )}
        {tab === "popular" && (
          <div>
            <p className="mb-3 text-[13px] text-muted-foreground">Live popularity from {work.providerName} — nothing is ranked by Yozora itself.</p>
            <MediaRail items={data.popular.map(fromDTO)} />
          </div>
        )}
      </div>
    </div>
  );
}

function Overview({ data, hub, hasUnits }: { data: WorkDetail; hub: string; hasUnits: boolean }) {
  const { work, units } = data;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-5">
        {/* honest guidance when this source serves nothing in-app */}
        {!hasUnits && <AvailabilityPanel data={data} hub={hub} />}
        <div>
          <h3 className="mb-2 text-[15px] font-bold">Synopsis</h3>
          <p className="text-[14px] leading-relaxed text-foreground/85">
            {work.description ?? "No synopsis is available from this source — open one of the provider links to read it there."}
          </p>
        </div>

        {work.tags.length > 0 && (
          <div>
            <h3 className="mb-2 text-[15px] font-bold">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {work.tags.map((t) => (
                <Badge key={t} variant="secondary" className="rounded-full bg-muted text-muted-foreground">{t}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* quick unit shortcuts on the overview too */}
        {units.chapters.length > 0 && (
          <div>
            <h3 className="mb-2 text-[15px] font-bold">Latest chapters</h3>
            <div className="flex flex-wrap gap-2">
              {[...units.chapters].sort((a, b) => b.number - a.number).slice(0, 6).map((c) => (
                <button
                  key={c.key}
                  onClick={() => navigate(`/read?p=${encodeURIComponent(work.provider)}&id=${encodeURIComponent(work.externalId)}&ch=${encodeURIComponent(c.key)}`)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-[12.5px] font-semibold transition-transform hover:scale-[1.03]"
                >
                  Ch. {c.number}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Details</h3>
          <dl className="space-y-2.5 text-[13px]">
            <Meta label="Category" value={categoryMeta(work.category).label} />
            {work.category === "AV" && work.videoKind && <Meta label="Video kind" value={videoKindLabel(work.videoKind)} />}
            {work.format && <Meta label="Format" value={work.format} />}
            {work.status && <Meta label="Status" value={STATUS_LABELS[work.status] ?? work.status} />}
            {work.year && <Meta label="Year" value={String(work.year)} />}
            {work.studio && <Meta label="Studio" value={work.studio} />}
            {work.creator && <Meta label={work.category === "GAME" ? "Developer" : "Author"} value={work.creator} />}
            <Meta label="Source" value={work.providerName} />
            {work.altTitles.length > 0 && <Meta label="Alt titles" value={work.altTitles.join(", ")} />}
          </dl>
        </div>
        {work.externalLinks.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Links</h3>
            <ul className="space-y-2">
              {work.externalLinks.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-[13px] font-semibold hover:underline" style={{ color: hub }}>
                    <ExternalLink className="h-3.5 w-3.5" /> {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground/90">{value}</dd>
    </div>
  );
}

// No in-app units at all → this source is metadata/directory-only here.
// Point people at the real provider links instead of pretending otherwise.
function AvailabilityPanel({ data, hub }: { data: WorkDetail; hub: string }) {
  const { work, provider: prov } = data;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <ExternalLink className="h-4 w-4" style={{ color: hub }} /> How to watch/read this
      </h3>
      {work.externalLinks.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {work.externalLinks.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={`${l.label} (opens in a new tab)`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[13px] font-bold transition-transform hover:scale-[1.03]"
              style={{ borderColor: `${hub}44`, background: `${hub}14`, color: hub }}
            >
              <ExternalLink className="h-3.5 w-3.5" /> {l.label}
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">This source exposes no links for this entry.</p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        This source is metadata/directory-only inside Yozora — no stream or pages are hosted or proxied for
        playback here. Use the links above, or browse its catalog from the{" "}
        <a href="#/extensions" className="font-semibold underline-offset-2 hover:underline" style={{ color: hub }}>
          Extensions page
        </a>
        .
      </p>
      {prov.configRequired && (
        <p className="mt-2 rounded-lg bg-background px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Config-gated source.</strong> {prov.name} requires your free API key —
          add it under <a href="#/extensions" className="underline underline-offset-2" style={{ color: hub }}>Extensions</a>{" "}
          to unlock live content.
        </p>
      )}
    </div>
  );
}

function EpisodeList({ data, hub }: { data: WorkDetail; hub: string }) {
  const { work, units } = data;
  const enc = encodeURIComponent;
  const watchHref = (key: string) => `/watch?p=${enc(work.provider)}&id=${enc(work.externalId)}&ep=${enc(key)}`;
  const externalOnly = !work.availability.watch;
  return (
    <div className="space-y-3">
      {externalOnly && units.episodes.some((e) => !e.streamUrl) && (
        <div className="flex items-center gap-2 rounded-xl border border-[#FFBE4A]/25 bg-[#FFBE4A]/10 px-4 py-3 text-[12.5px] text-foreground/85">
          <ShieldAlert className="h-4 w-4 shrink-0 text-[#FFBE4A]" />
          <span><span className="font-bold text-[#FFBE4A]">External playback only.</span> This source does not serve streams to Yozora — episodes open on {work.providerName}.</span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {units.episodes.map((ep) => (
          <button
            key={ep.key}
            onClick={() => navigate(watchHref(ep.key))}
            className="group flex gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-lg bg-muted">
              {ep.thumbnailUrl && (
                <img src={ep.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                <Play className="h-7 w-7 fill-white text-white" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold">
                <span style={{ color: hub }}>EP {ep.number}</span> · {ep.title ?? `Episode ${ep.number}`}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDuration(ep.durationSec)}</p>
              {ep.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ep.summary}</p>}
              {ep.streamUrl ? (
                <span className="mt-1.5 inline-block rounded-full bg-[#3BD47A]/15 px-2 py-0.5 text-[10px] font-bold text-[#3BD47A]">Plays in-app</span>
              ) : (
                <span className="mt-1.5 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">External playback only</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChapterList({ data, hub }: { data: WorkDetail; hub: string }) {
  const { work, units } = data;
  const enc = encodeURIComponent;
  const readHref = (key: string) => `/read?p=${enc(work.provider)}&id=${enc(work.externalId)}&ch=${enc(key)}`;
  // newest first regardless of the order the adapter streams them in
  const ordered = [...units.chapters].sort((a, b) => b.number - a.number);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {ordered.map((ch, i) => (
        <button
          key={ch.key}
          onClick={() => navigate(readHref(ch.key))}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5",
            i % 2 === 1 && "bg-card",
            i % 2 === 0 && "bg-card/60"
          )}
        >
          <BookOpen className="h-4 w-4 shrink-0" style={{ color: hub }} />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold">
              Ch. {ch.number} {ch.title ? `— ${ch.title}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {ch.pageCount !== null ? `${ch.pageCount} pages` : "pages load from source"}
              {ch.resolveUrl && (
                <span className="ml-1.5 inline-flex items-center gap-0.5" title="Pages resolve live from the source when you open this chapter">
                  <Zap className="inline h-3 w-3" style={{ color: hub }} /> loads live from source
                </span>
              )}
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">Read →</span>
        </button>
      ))}
    </div>
  );
}

function GalleryPreview({ data, hub }: { data: WorkDetail; hub: string }) {
  const { work, units } = data;
  const preview = units.images.slice(0, 6);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {preview.map((g, i) => (
          <img key={g.url} src={g.thumbUrl ?? g.url} alt={`Gallery image ${i + 1}`} className="aspect-[2/3] w-full rounded-lg object-cover" loading="lazy" />
        ))}
      </div>
      <div className="mt-4 text-center">
        <button
          onClick={() => navigate(`/gallery?p=${encodeURIComponent(work.provider)}&id=${encodeURIComponent(work.externalId)}`)}
          className="inline-flex h-11 items-center gap-2 rounded-2xl px-6 text-sm font-bold"
          style={{ background: `${hub}1a`, color: hub }}
        >
          <ImageIcon className="h-4 w-4" /> Open gallery viewer ({units.images.length} images)
        </button>
      </div>
    </div>
  );
}
