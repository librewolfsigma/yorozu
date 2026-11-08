"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Play, ChevronRight, Sparkles, Clock, Users, Puzzle, AlertTriangle,
  Compass, BookOpen, Image as ImageIcon, Tv,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { navigate } from "@/hooks/use-hash-route";
import { useAuth } from "@/components/providers";
import { MediaRail, MediaGrid, fromDTO, GridSkeleton } from "@/components/media/card";
import { categoryMeta, videoKindLabel } from "@/lib/category-meta";
import type { WorkDTO } from "@/lib/serialize";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Client-safe proxy builder (mirrors lib/imgproxy.proxyUrl without its
// server-only import chain — node:child_process cannot enter the bundle).
function proxyImg(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return `/api/img?u=${encodeURIComponent(raw)}`;
}

interface FeedPage {
  category: string;
  page: number;
  items: WorkDTO[];
  hasMore: boolean;
  providers: { id: string; name: string; error: string | null; count: number }[];
}

interface ContinueItem {
  provider: string;
  externalId: string;
  ref: string;
  category: string;
  kind: string; // EPISODE | CHAPTER | GALLERY
  unitKey: string;
  unitLabel: string | null;
  positionSec: number | null;
  pageIndex: number | null;
  completed: boolean;
  titleSnapshot: string;
  coverSnapshot: string | null;
  updatedAt: string;
}

interface ProviderLite {
  id: string;
  name: string;
  category: string;
  videoKind: string | null;
  status: string;
  installed: boolean;
  configRequired: boolean;
  availability: { watch: boolean; read: boolean; view: boolean };
}

interface HomeData {
  hero: WorkDTO[];
  popular: WorkDTO[];
  categories: Record<string, WorkDTO[]>;
  continue: ContinueItem[];
  stats: { providers: number; degraded: number; categories: number };
  user: { id: string; username: string } | null;
}

const HERO_IMAGES = ["/media/hero-1.png", "/media/hero-2.png", "/media/hero-3.png"];

export default function HomeView() {
  const { data, isLoading } = useQuery({
    queryKey: ["home"],
    queryFn: () => api<HomeData>("/api/home"),
  });
  // Provider-based home: the installed-source strip is the Mihon-style entry
  // point — every source is one tap from the landing page.
  const { data: provData } = useQuery({
    queryKey: ["providers-installed"],
    queryFn: () => api<{ installed: ProviderLite[] }>("/api/providers"),
    staleTime: 120_000,
  });
  const { user } = useAuth();

  if (isLoading || !data) {
    return (
      <div className="space-y-8 py-2">
        <div className="yz-skeleton h-[340px] rounded-2xl" />
        <GridSkeleton count={6} />
      </div>
    );
  }

  const hero = data.hero[0];
  const heroMeta = hero ? categoryMeta(hero.category) : null;

  return (
    <div className="space-y-8 pb-6">
      {/* ── Spotlight — compact Aniyomi-style wide cards (no giant hero) ── */}
      {hero && heroMeta && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-white">
              <Sparkles className="h-4 w-4 text-primary" /> Spotlight
            </h2>
            <span className="rounded-full bg-[#EF5B6B]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF8B96]">18+</span>
          </div>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x">
            {data.hero.slice(0, 10).map((m) => {
              const mm = categoryMeta(m.category);
              return (
                <button
                  key={m.ref}
                  onClick={() => navigate(`/media?p=${encodeURIComponent(m.provider)}&id=${encodeURIComponent(m.externalId)}`)}
                  className="group relative h-[148px] w-[280px] shrink-0 snap-start overflow-hidden rounded-xl border border-border text-left sm:w-[320px]"
                  aria-label={`Open ${m.title}`}
                >
                  <img
                    src={proxyImg(m.bannerUrl || m.coverUrl) || HERO_IMAGES[0]}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-75"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider" style={{ background: `${mm.hub}26`, color: mm.hub }}>
                      {mm.label} · via {m.providerName}
                    </span>
                    <p className="mt-1.5 line-clamp-2 text-[13.5px] font-bold leading-snug text-white">{m.title}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Continue ── */}
      {user && data.continue.length > 0 && (
        <Section title="Continue where you left off" icon={<Clock className="h-4.5 w-4.5" />} href="/history">
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x">
            {data.continue.map((c) => (
              <ContinueCard key={c.ref} item={c} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Your sources — the provider-based entry point (Mihon-style) ── */}
      {(provData?.installed ?? []).filter((p) => p.installed).length > 0 && (
        <Section title="Your sources" icon={<Puzzle className="h-4.5 w-4.5" />} href="/sources">
          <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
            {provData!.installed
              .filter((p) => p.installed)
              .slice(0, 24)
              .map((p) => {
                const m = categoryMeta(p.category);
                const Icon = m.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/source/${p.id}`)}
                    className="group flex w-[150px] shrink-0 snap-start flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg press-scale"
                    aria-label={`Open source ${p.name}`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg hub-soft" style={{ color: m.hub }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="line-clamp-1 text-[12.5px] font-bold">{p.name}</span>
                    <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          p.configRequired || p.status === "UNCONFIGURED" ? "bg-[#FFBE4A]" : p.status === "ERROR" ? "bg-[#EF5B6B]" : p.status === "ACTIVE" ? "bg-[#3BD47A]" : "bg-muted-foreground/40",
                        )}
                      />
                      {p.videoKind ? videoKindLabel(p.videoKind) : m.label}
                    </span>
                  </button>
                );
              })}
            <button
              onClick={() => navigate("/sources")}
              className="flex w-[110px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className="h-5 w-5" />
              <span className="text-[11.5px] font-bold">All sources</span>
            </button>
          </div>
        </Section>
      )}

      {/* ── Trending per category tabs — infinite append, so new upstream
          items surface here as providers add them (not a fixed 14) ── */}
      <Section title="Trending this week" icon={<Sparkles className="h-4.5 w-4.5" />}>
        <CategoryTabs categories={data.categories} />
      </Section>

      {/* ── Popular grid ── */}
      <Section title="Popular right now" icon={<Users className="h-4.5 w-4.5" />} href="/browse/ANIME">
        <MediaGrid items={data.popular.slice(0, 12).map(fromDTO)} />
      </Section>

      {/* ── Stats strip (provider health — Yozora stores no catalog) ── */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "Providers installed", value: data.stats.providers, icon: Puzzle },
          { label: "Providers degraded", value: data.stats.degraded, icon: AlertTriangle, warn: data.stats.degraded > 0 },
          { label: "Live categories", value: data.stats.categories, icon: Compass },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <s.icon className={cn("mx-auto h-4.5 w-4.5", s.warn ? "text-[#EF5B6B]" : "text-muted-foreground")} />
            <p className="mt-1.5 font-display text-2xl text-white">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

/** Resume card: deep-links straight back into the exact episode/chapter/gallery. */
function ContinueCard({ item }: { item: ContinueItem }) {
  const meta = categoryMeta(item.category);
  const p = encodeURIComponent(item.provider);
  const id = encodeURIComponent(item.externalId);
  const href =
    item.kind === "EPISODE"
      ? `/watch?p=${p}&id=${id}&ep=${encodeURIComponent(item.unitKey)}`
      : item.kind === "CHAPTER"
        ? `/read?p=${p}&id=${id}&ch=${encodeURIComponent(item.unitKey)}`
        : `/gallery?p=${p}&id=${id}`;
  const KindIcon = item.kind === "EPISODE" ? Tv : item.kind === "CHAPTER" ? BookOpen : ImageIcon;
  const kindLabel =
    item.kind === "EPISODE" ? "Episode" : item.kind === "CHAPTER" ? "Chapter" : "Gallery";

  return (
    <div
      className="poster-card group w-[150px] shrink-0 cursor-pointer select-none snap-start"
      onClick={() => navigate(href)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(href)}
      aria-label={`Resume ${item.titleSnapshot}${item.unitLabel ? ` — ${item.unitLabel}` : ""}`}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-xl card-ring bg-[#141B30]"
        style={{ ["--hub" as string]: meta.hub }}
      >
        {item.coverSnapshot ? (
          <img
            src={item.coverSnapshot}
            alt={`${item.titleSnapshot} cover`}
            loading="lazy"
            className="poster-img h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: meta.hub, color: "var(--primary-foreground)" }}>
            <Play className="h-5 w-5 fill-current" />
          </div>
        </div>
        <div className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          <KindIcon className="h-3 w-3" /> {item.unitLabel ?? kindLabel}
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-1 text-[13px] font-semibold text-foreground/90 group-hover:text-white transition-colors">
          {item.titleSnapshot}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span style={{ color: meta.hub }} className="font-semibold">{kindLabel}</span>
          {item.unitLabel && <span>· {item.unitLabel}</span>}
        </p>
      </div>
    </div>
  );
}

function Section({ title, icon, href, children }: { title: string; icon?: React.ReactNode; href?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          {icon && <span className="text-primary">{icon}</span>}
          {title}
        </h2>
        {href && (
          <a href={`#${href}`} className="flex items-center gap-0.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-primary">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Category tabs with INFINITE APPEND: the first page comes from the home
 * aggregate; "Load more" pulls the next page live from /api/feed so the rail
 * grows beyond the initial 14 whenever upstream has more.
 */
function CategoryTabs({ categories }: { categories: Record<string, WorkDTO[]> }) {
  const keys = Object.keys(categories).filter((k) => categories[k]?.length);
  const [active, setActive] = useState(keys[0] ?? "ANIME");
  const meta = categoryMeta(active);
  const [extra, setExtra] = useState<WorkDTO[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // switching category tabs resets the appended pages
  useEffect(() => {
    setExtra([]);
    setPage(1);
    setHasMore(false);
    setLoadError(null);
    setLoadingMore(false);
  }, [active]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const next = await api<FeedPage>(`/api/feed?category=${encodeURIComponent(active)}&page=${page + 1}`);
      setExtra((prev) => {
        const base = [...(categories[active] ?? []), ...prev].map((i) => i.ref);
        const seen = new Set(base);
        return [...prev, ...next.items.filter((i) => !seen.has(i.ref))];
      });
      setPage(next.page);
      setHasMore(next.hasMore);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load more right now");
    } finally {
      setLoadingMore(false);
    }
  };

  const items = [...(categories[active] ?? []), ...extra];

  return (
    <div>
      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {keys.map((k) => {
          const km = categoryMeta(k);
          const Icon = km.icon;
          const isActiveTab = k === active;
          return (
            <button
              key={k}
              onClick={() => setActive(k)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all",
                isActiveTab ? "border-transparent" : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
              style={isActiveTab ? { background: `${km.hub}1f`, color: km.hub, borderColor: `${km.hub}55` } : undefined}
            >
              <Icon className="h-3.5 w-3.5" /> {km.label}
            </button>
          );
        })}
      </div>
      {keys.includes(active) ? (
        <div style={{ ["--hub" as string]: meta.hub }}>
          <MediaRail items={items.map(fromDTO)} showRank />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {loadError ? (
              <p className="flex items-center gap-2 text-xs text-[#FF8B96]">
                <AlertTriangle className="h-3.5 w-3.5" /> {loadError}
              </p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="gap-1.5 rounded-lg border-border bg-card"
            >
              {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {loadingMore ? "Loading…" : hasMore || page > 1 ? "Load more" : "Load more from providers"}
            </Button>
            <a
              href={`#/browse/${active}`}
              className="flex items-center gap-0.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              Browse all {meta.label} <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No live titles in this category right now.</p>
      )}
    </div>
  );
}
