"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Play, BookOpen, Image as ImageIcon, Gamepad2, Info, Users, Star, ShieldAlert,
  FileCode2, ExternalLink, FolderHeart, PlayCircle, MessagesSquare, LayoutGrid, FileDown, Puzzle,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { categoryMeta, fmtDuration, STATUS_LABELS, fmtNumber } from "@/lib/category-meta";
import { MediaCard, fromDTO, GridSkeleton } from "@/components/media/card";
import {
  AddToLibraryButton, CollectionPicker, FavoriteButton, ReportDialog,
  ReviewSection, DownloadButton, ProviderChips, type LibraryState,
} from "@/components/media/actions";
import { navigate } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface DetailData {
  media: {
    id: string; slug: string; title: string; altTitles: string[];
    description: string | null; coverUrl: string | null; bannerUrl: string | null;
    accent: string | null; accent2: string | null; category: string;
    videoKind: string | null;
    format: string | null; status: string | null; year: number | null;
    rating: number; ratingCount: number; popularity: number;
    genres: string[]; tags: string[]; studio: string | null; creator: string | null;
    ageRating: string; contentFlags: string[];
    externalLinks: { label: string; url: string }[];
    extra: Record<string, unknown>;
  };
  episodes: { id: string; number: number; title: string | null; durationSec: number | null; thumbnailUrl: string | null; streamUrl: string | null; streamType: string | null; summary: string | null; releasedAt: string | null }[];
  chapters: { id: string; number: number; title: string | null; pageCount: number; releasedAt: string | null }[];
  gallery: { id: string; idx: number; imageUrl: string; thumbUrl: string | null; tags: string[]; favCount: number }[];
  characters: { id: string; name: string; role: string | null; description: string | null; imageUrl: string | null }[];
  people: { id: string; name: string; kind: string; bio: string | null; role: string }[];
  reviews: { id: string; score: number; title: string | null; body: string | null; createdAt: string; user: { username: string; displayName: string; avatarUrl: string | null }; isMine: boolean }[];
  links: { providerId: string; externalId: string; externalUrl: string | null }[];
  providers: { id: string; name: string; status: string }[];
  related: Parameters<typeof MediaCard>[0]["media"][];
  library: LibraryState | null;
  myCollections: { id: string; name: string; hasItem: boolean }[];
}

export default function DetailView({ slug }: { slug?: string }) {
  const [tab, setTab] = useState("overview");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["media", slug],
    queryFn: () => api<DetailData>(`/api/media/${slug}`),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 py-2">
        <div className="yz-skeleton h-64 rounded-2xl" />
        <GridSkeleton count={6} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="py-24 text-center">
        <p className="font-semibold">Title not found</p>
        <p className="mt-1 text-sm text-muted-foreground">{(error as Error)?.message ?? "It may have been removed."}</p>
        <a href="#/browse/ANIME" className="mt-4 inline-block text-sm font-semibold text-[#3DB4F2] hover:underline">← Back to browse</a>
      </div>
    );
  }

  const { media } = data;
  const meta = categoryMeta(media.category);
  const hub = media.accent ?? meta.hub;
  const Icon = meta.icon;

  // pick the primary unit list based on category
  const unitsTab = media.category === "ANIME" || media.category === "AV"
    ? "episodes"
    : media.category === "MANGA" || media.category === "MANHWA"
      ? "chapters"
      : media.category === "ILLUSTRATION"
        ? "gallery"
        : media.category === "GAME" ? "files" : media.category === "SCRIPT" ? "files" : "about";

  const resumeLabel = media.category === "ANIME" ? "Watch now" : media.category === "AV" ? "Play now" : media.category === "GAME" ? "Get game" : meta.action;
  const firstUnitHref =
    unitsTab === "episodes" ? (data.episodes[0] ? `/watch/${media.slug}/${data.episodes[0].id}` : null)
    : unitsTab === "chapters" ? (data.chapters[0] ? `/read/${media.slug}/${data.chapters[0].id}` : null)
    : unitsTab === "gallery" ? (data.gallery.length > 0 ? `/gallery/${media.slug}` : null)
    : null;

  // resolve a friendly provider name for the "via …" chip
  const importedFrom = typeof media.extra.importedFrom === "string" ? media.extra.importedFrom : null;
  const viaProvider =
    (importedFrom
      ? data.providers.find((p) => p.id === importedFrom || p.name === importedFrom)?.name ?? importedFrom
      : null)
    ?? (data.providers.length > 0 ? data.providers.map((p) => p.name).join(" · ") : null);

  return (
    <div className="-mx-4 lg:-mx-5" style={{ ["--hub" as string]: hub }}>
      {/* ── Themed hero ── */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${hub}2e 0%, #101a2a 45%, #0B1622 100%)` }}
        />
        {media.bannerUrl && (
           
          <img src={media.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1622] via-transparent to-transparent" />

        <div className="relative mx-auto grid max-w-[1140px] gap-6 px-4 pb-6 pt-8 sm:grid-cols-[200px_1fr] sm:px-5 lg:px-5">
          <div className="mx-auto w-40 sm:mx-0 sm:w-full">
            { }
            <img
              src={media.coverUrl ?? ""}
              alt={`${media.title} cover`}
              className="aspect-[2/3] w-full rounded-2xl card-ring-lg object-cover"
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: `${hub}22`, color: hub }}>
                <Icon className="h-3.5 w-3.5" /> {meta.label}
              </span>
              <Badge variant="secondary" className="rounded-full bg-[#EF5B6B]/15 text-[10px] font-bold text-[#FF8B96]">{media.ageRating}</Badge>
              {media.format && <span className="text-xs text-muted-foreground">{media.format}</span>}
              {media.videoKind && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${hub}1a`, color: hub }} title="Video subcategory — kept distinct by design (never merged into Anime)">
                  {media.videoKind === "CREATOR" ? "INDIE CREATOR" : media.videoKind}
                </span>
              )}
              {media.status && <span className="text-xs font-semibold" style={{ color: hub }}>{STATUS_LABELS[media.status] ?? media.status}</span>}
              {media.year && <span className="text-xs text-muted-foreground">· {media.year}</span>}
              {viaProvider && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                  title={`Imported from ${viaProvider}`}
                >
                  <Puzzle className="h-3 w-3" style={{ color: hub }} /> via {viaProvider}
                </span>
              )}
            </div>

            <h1 className="mt-2.5 font-display text-3xl leading-tight text-white sm:text-4xl lg:text-5xl">{media.title}</h1>
            {media.altTitles.length > 0 && (
              <p className="mt-1 text-[13px] text-muted-foreground">Also known as: {media.altTitles.join(" · ")}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
              <span className="flex items-center gap-1 font-bold text-[#FFBE4A]">
                <Star className="h-4 w-4 fill-[#FFBE4A]" /> {media.rating.toFixed(1)}
                <span className="ml-1 font-normal text-muted-foreground">({fmtNumber(media.ratingCount)})</span>
              </span>
              <span className="text-muted-foreground">{fmtNumber(media.popularity)} in libraries</span>
              {media.studio && <span className="text-muted-foreground">Studio: <span className="text-foreground/90">{media.studio}</span></span>}
              {media.creator && <span className="text-muted-foreground">{media.category === "GAME" ? "Developer" : "Author"}: <span className="text-foreground/90">{media.creator}</span></span>}
            </div>

            {/* genres */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {media.genres.map((g) => (
                <a key={g} href={`#/browse/${media.category}?q=&sort=POPULAR`} className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors" style={{ borderColor: `${hub}44`, color: hub, background: `${hub}0d` }}>
                  {g}
                </a>
              ))}
            </div>

            {/* actions */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {firstUnitHref ? (
                <button
                  onClick={() => navigate(firstUnitHref)}
                  className="flex h-12 items-center gap-2 rounded-2xl cta-gradient px-7 text-[15px] font-bold"
                >
                  <Play className="h-4.5 w-4.5 fill-current" /> {resumeLabel}
                </button>
              ) : media.externalLinks.length > 0 ? (
                <a href={media.externalLinks[0].url} target="_blank" rel="noopener noreferrer nofollow" className="flex h-12 items-center gap-2 rounded-2xl cta-gradient px-7 text-[15px] font-bold">
                  <ExternalLink className="h-4.5 w-4.5" /> Open resource
                </a>
              ) : (
                <button
                  onClick={() => navigate("/extensions")}
                  className="flex h-12 items-center gap-2 rounded-2xl cta-gradient px-7 text-[15px] font-bold"
                >
                  <Puzzle className="h-4.5 w-4.5" /> Get from a provider
                </button>
              )}
              <AddToLibraryButton mediaId={media.id} library={data.library} hub={hub} />
              <FavoriteButton mediaId={media.id} favorite={data.library?.favorite ?? false} hub={hub} />
              <CollectionPicker mediaId={media.id} hub={hub} collections={data.myCollections} />
              <ReportDialog targetType="MEDIA" targetId={media.id} />
            </div>

            {/* content flags */}
            {media.contentFlags.length > 0 && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#FFBE4A]/25 bg-[#FFBE4A]/10 p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#FFBE4A]" />
                <div className="text-[12.5px] leading-relaxed text-foreground/85">
                  <span className="font-bold text-[#FFBE4A]">Content notice (18+): </span>
                  {media.contentFlags.join(" · ")}
                </div>
              </div>
            )}

            <div className="mt-3">
              <ProviderChips providers={data.providers} links={data.links} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="mx-auto max-w-[1140px] px-4 pb-10 sm:px-5">
        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="mb-5 flex-wrap gap-1 rounded-xl bg-card p-1">
            <TabsTrigger value="overview" className="gap-1.5 rounded-lg"><Info className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            {unitsTab === "episodes" && data.episodes.length > 0 && <TabsTrigger value="episodes" className="gap-1.5 rounded-lg"><PlayCircle className="h-3.5 w-3.5" /> Episodes ({data.episodes.length})</TabsTrigger>}
            {unitsTab === "chapters" && data.chapters.length > 0 && <TabsTrigger value="chapters" className="gap-1.5 rounded-lg"><BookOpen className="h-3.5 w-3.5" /> Chapters ({data.chapters.length})</TabsTrigger>}
            {unitsTab === "gallery" && data.gallery.length > 0 && <TabsTrigger value="gallery" className="gap-1.5 rounded-lg"><ImageIcon className="h-3.5 w-3.5" /> Gallery ({data.gallery.length})</TabsTrigger>}
            {unitsTab === "files" && <TabsTrigger value="files" className="gap-1.5 rounded-lg"><FileDown className="h-3.5 w-3.5" /> Files & install</TabsTrigger>}
            {(data.characters.length > 0 || data.people.length > 0) && <TabsTrigger value="characters" className="gap-1.5 rounded-lg"><Users className="h-3.5 w-3.5" /> Characters ({data.characters.length})</TabsTrigger>}
            <TabsTrigger value="reviews" className="gap-1.5 rounded-lg"><MessagesSquare className="h-3.5 w-3.5" /> Reviews ({data.reviews.length})</TabsTrigger>
            <TabsTrigger value="related" className="gap-1.5 rounded-lg"><LayoutGrid className="h-3.5 w-3.5" /> Related</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "overview" && <Overview data={data} hub={hub} />}
        {tab === "episodes" && (data.episodes.length > 0
          ? <EpisodeList data={data} hub={hub} />
          : <p className="py-8 text-center text-sm text-muted-foreground">No episodes were imported for this title yet.</p>)}
        {tab === "chapters" && (data.chapters.length > 0
          ? <ChapterList data={data} hub={hub} />
          : <p className="py-8 text-center text-sm text-muted-foreground">No chapters were imported for this title yet.</p>)}
        {tab === "gallery" && (data.gallery.length > 0
          ? <GalleryPreview slug={media.slug} hub={hub} count={data.gallery.length} />
          : <p className="py-8 text-center text-sm text-muted-foreground">No gallery images were imported for this title yet.</p>)}
        {tab === "files" && <FilesPanel data={data} hub={hub} />}
        {tab === "characters" && <Characters people={data.people} characters={data.characters} />}
        {tab === "reviews" && (
          <ReviewSection mediaId={media.id} reviews={data.reviews} hub={hub} rating={media.rating} ratingCount={media.ratingCount} />
        )}
        {tab === "related" && (
          data.related.length > 0
            ? <MediaGridInline items={data.related} />
            : <p className="py-8 text-center text-sm text-muted-foreground">Nothing related yet.</p>
        )}
      </div>
    </div>
  );
}

function Overview({ data, hub }: { data: DetailData; hub: string }) {
  const { media } = data;
  const extra = media.extra as {
    engine?: string; platforms?: string[]; sizeGb?: number; version?: string;
    officialUrl?: string; requirements?: Record<string, string>;
    permissions?: { domain: string; reason: string }[];
    installs?: number; sourceUrl?: string; kind?: string;
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-5">
        {/* honest guidance when nothing playable was imported */}
        {data.episodes.length === 0 && data.chapters.length === 0 && data.gallery.length === 0 && (
          <HowToWatch data={data} hub={hub} />
        )}
        <div>
          <h3 className="mb-2 text-[15px] font-bold">Synopsis</h3>
          <p className="text-[14px] leading-relaxed text-foreground/85">
            {media.description ?? "No synopsis has been imported for this title yet — open one of the provider links to read it at the source."}
          </p>
        </div>

        {/* category-specific blocks */}
        {media.category === "GAME" && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="flex items-center gap-2 text-[15px] font-bold"><Gamepad2 className="h-4 w-4" style={{ color: hub }} /> Technical details</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
              {extra.engine && <Meta label="Engine" value={extra.engine} />}
              {extra.version && <Meta label="Version" value={extra.version} />}
              {extra.sizeGb && <Meta label="Size" value={`${extra.sizeGb} GB`} />}
              {extra.platforms && <Meta label="Platforms" value={extra.platforms.join(", ")} />}
              {extra.requirements && Object.entries(extra.requirements).map(([k, v]) => (
                <Meta key={k} label={k} value={v} />
              ))}
            </dl>
          </div>
        )}

        {media.category === "SCRIPT" && extra.permissions && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="flex items-center gap-2 text-[15px] font-bold"><FileCode2 className="h-4 w-4" style={{ color: hub }} /> Requested permissions</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This platform never executes third-party code. Installs are tracked metadata with enable/disable control (sandboxed).
            </p>
            <ul className="mt-3 space-y-1.5">
              {extra.permissions.map((p) => (
                <li key={p.domain} className="flex items-center gap-2 text-[13px]">
                  <Badge variant="secondary" className="rounded-md bg-background font-mono text-[11px]">{p.domain}</Badge>
                  <span className="text-muted-foreground">{p.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {media.tags.length > 0 && (
          <div>
            <h3 className="mb-2 text-[15px] font-bold">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {media.tags.map((t) => (
                <Badge key={t} variant="secondary" className="rounded-full bg-muted text-muted-foreground">{t}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Details</h3>
          <dl className="space-y-2.5 text-[13px]">
            <Meta label="Category" value={categoryMeta(media.category).label} />
            {media.format && <Meta label="Format" value={media.format} />}
            {media.status && <Meta label="Status" value={STATUS_LABELS[media.status] ?? media.status} />}
            {media.year && <Meta label="Year" value={String(media.year)} />}
            {media.studio && <Meta label="Studio" value={media.studio} />}
            {media.creator && <Meta label={media.category === "GAME" ? "Developer" : "Author"} value={media.creator} />}
            <Meta label="Age rating" value={media.ageRating} />
            {media.altTitles.length > 0 && <Meta label="Alt titles" value={media.altTitles.join(", ")} />}
          </dl>
        </div>
        {media.externalLinks.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Links</h3>
            <ul className="space-y-2">
              {media.externalLinks.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] font-semibold hover:underline" style={{ color: hub }}>
                    <ExternalLink className="h-3.5 w-3.5" /> {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.people.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Credits</h3>
            <ul className="space-y-2 text-[13px]">
              {data.people.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-muted-foreground">{p.role}</span>
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

// Metadata-only import: no episodes / chapters / gallery — point people at the
// real provider links instead of pretending there is something to play.
function HowToWatch({ data, hub }: { data: DetailData; hub: string }) {
  const { media } = data;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <ExternalLink className="h-4 w-4" style={{ color: hub }} /> How to watch/read this
      </h3>
      {media.externalLinks.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {media.externalLinks.map((l) => (
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
        <p className="mt-2 text-[13px] text-muted-foreground">This entry has no provider links attached yet.</p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        No stream or pages are hosted by Yozora for this title — use the provider links above, or browse its
        source catalog from the{" "}
        <a href="#/extensions" className="font-semibold underline-offset-2 hover:underline" style={{ color: hub }}>
          Extensions page
        </a>{" "}
        to import playable content.
      </p>
      {Boolean((media.extra as { metadataOnly?: boolean })?.metadataOnly) && (
        <p className="mt-2 rounded-lg bg-background px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Metadata-only record.</strong> This entry came from a metadata
          database (StashDB / JAVStash / FansDB / PMV Stash / MangaUpdates / AniDB). It catalogs the title,
          performers/studio and tags — playback availability is a separate thing and happens on the external site.
        </p>
      )}
    </div>
  );
}

function EpisodeList({ data, hub }: { data: DetailData; hub: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.episodes.map((ep) => (
        <button
          key={ep.id}
          onClick={() => navigate(`/watch/${data.media.slug}/${ep.id}`)}
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
              <span style={{ color: hub }}>EP {ep.number}</span> · {ep.title}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDuration(ep.durationSec)}</p>
            {ep.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ep.summary}</p>}
            {ep.streamUrl ? (
              <span className="mt-1.5 inline-block rounded-full bg-[#3BD47A]/15 px-2 py-0.5 text-[10px] font-bold text-[#3BD47A]">Stream available</span>
            ) : (
              <span className="mt-1.5 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">No authorized stream — external links only</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function ChapterList({ data, hub }: { data: DetailData; hub: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {data.chapters.map((ch, i) => (
        <button
          key={ch.id}
          onClick={() => navigate(`/read/${data.media.slug}/${ch.id}`)}
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
              {ch.pageCount} pages{ch.releasedAt ? ` · ${new Date(ch.releasedAt).toLocaleDateString()}` : ""}
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">Read →</span>
        </button>
      ))}
    </div>
  );
}

function GalleryPreview({ slug, hub, count }: { slug: string; hub: string; count: number }) {
  const { data } = useQuery({
    queryKey: ["media", slug],
    select: (d: DetailData) => d.gallery.slice(0, 12),
  });
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {(data ?? []).map((g) => (
           
          <img key={g.id} src={g.thumbUrl ?? g.imageUrl} alt={`Gallery image ${g.idx + 1}`} className="aspect-[2/3] w-full rounded-lg object-cover" loading="lazy" />
        ))}
      </div>
      <div className="mt-4 text-center">
        <button onClick={() => navigate(`/gallery/${slug}`)} className="inline-flex h-11 items-center gap-2 rounded-2xl px-6 text-sm font-bold" style={{ background: `${hub}1a`, color: hub }}>
          <ImageIcon className="h-4 w-4" /> Open full gallery ({count} images)
        </button>
      </div>
    </div>
  );
}

function FilesPanel({ data, hub }: { data: DetailData; hub: string }) {
  const extra = data.media.extra as { officialUrl?: string; version?: string; sizeGb?: number; sourceUrl?: string; installs?: number };
  const isGame = data.media.category === "GAME";
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-bold">{isGame ? "Game installation" : "Script installation"}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {isGame
                ? "Yozora hosts no game files — use the official store page or magnet links from your providers. Downloads in Yozora stream real files only."
                : "Scripts are sandboxed: Yozora records the install and permissions but never executes third-party code. Manage in Scripts."}
            </p>
          </div>
          <div className="flex gap-2">
            {isGame && extra.officialUrl && (
              <a href={extra.officialUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15">
                <ExternalLink className="h-4 w-4" /> Official page
              </a>
            )}
            {!isGame && extra.sourceUrl && (
              <a href={extra.sourceUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15">
                <ExternalLink className="h-4 w-4" /> Source
              </a>
            )}
            <DownloadButton
              mediaId={data.media.id}
              label={`${data.media.title}${extra.version ? ` v${extra.version}` : ""}`}
              kind={isGame ? "GAME" : "SCRIPT"}
              hub={hub}
            />
          </div>
        </div>
        {isGame && extra.version && (
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center text-[13px]">
            <div><p className="font-bold">v{extra.version}</p><p className="text-[11px] text-muted-foreground">Version</p></div>
            <div><p className="font-bold">{extra.sizeGb ?? "—"} GB</p><p className="text-[11px] text-muted-foreground">Download size</p></div>
            <div><p className="font-bold">Official</p><p className="text-[11px] text-muted-foreground">Source policy</p></div>
          </div>
        )}
        {!isGame && extra.installs !== undefined && (
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center text-[13px]">
            <div><p className="font-bold">{fmtNumber(extra.installs)}</p><p className="text-[11px] text-muted-foreground">Installs</p></div>
            <div><p className="font-bold">v{extra.version ?? "—"}</p><p className="text-[11px] text-muted-foreground">Version</p></div>
            <div><p className="font-bold">Sandboxed</p><p className="text-[11px] text-muted-foreground">Execution policy</p></div>
          </div>
        )}
      </div>
      {data.media.category === "MISC" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[15px] font-bold">About this resource</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Curated external resource. Yozora links out to official pages only.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <FolderHeart className="h-4 w-4 shrink-0" />
        Provider licensing and download permissions are respected: if a source does not permit downloads, its adapter marks items as stream-only.
      </div>
    </div>
  );
}

function Characters({ characters, people }: { characters: DetailData["characters"]; people: DetailData["people"] }) {
  if (characters.length === 0 && people.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No character data yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {characters.map((c) => (
        <div key={c.id} className="rounded-xl border border-border bg-card p-3 text-center">
          {c.imageUrl && (
             
            <img src={c.imageUrl} alt={c.name} className="mx-auto h-16 w-16 rounded-xl object-cover" />
          )}
          <p className="mt-2 text-[13.5px] font-bold">{c.name}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#3DB4F2" }}>{c.role}</p>
          {c.description && <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">{c.description}</p>}
        </div>
      ))}
      {people.map((p) => (
        <div key={`p-${p.id}`} className="rounded-xl border border-dashed border-border bg-card/50 p-3 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-muted font-display text-2xl text-muted-foreground">
            {p.name.slice(0, 1)}
          </span>
          <p className="mt-2 text-[13.5px] font-bold">{p.name}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{p.role}</p>
          {p.bio && <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">{p.bio}</p>}
        </div>
      ))}
    </div>
  );
}

function MediaGridInline({ items }: { items: DetailData["related"] }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {items.map((m) => (
        <MediaCard key={m.id} media={m} />
      ))}
    </div>
  );
}
