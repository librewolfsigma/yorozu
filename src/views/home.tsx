"use client";

import { useQuery } from "@tanstack/react-query";
import { Play, Info, ChevronRight, Tv, BookOpen, ScrollText, Image as ImageIcon, Video, Gamepad2, Sparkles, Clock, Users, Puzzle, BookMarked } from "lucide-react";
import { api } from "@/lib/client-api";
import { navigate } from "@/hooks/use-hash-route";
import { useAuth } from "@/components/providers";
import { MediaRail, MediaGrid, fromDTO, GridSkeleton } from "@/components/media/card";
import { categoryMeta, CATEGORIES } from "@/lib/category-meta";
import type { MediaDTO } from "@/lib/serialize";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface HomeData {
  hero: MediaDTO[];
  popular: MediaDTO[];
  categories: Record<string, MediaDTO[]>;
  continue: { media: MediaDTO; kind: string; completed: boolean; positionSec: number | null; updatedAt: string }[];
  stats: { media: number; providers: number; chapters: number; episodes: number; galleryImages: number; characters: number };
  user: { id: string; username: string } | null;
}

const HERO_IMAGES = ["/media/hero-1.png", "/media/hero-2.png", "/media/hero-3.png"];

export default function HomeView() {
  const { data, isLoading } = useQuery({
    queryKey: ["home"],
    queryFn: () => api<HomeData>("/api/home"),
  });
  const { user } = useAuth();
  const [heroIdx, setHeroIdx] = useState(0);

  if (isLoading || !data) {
    return (
      <div className="space-y-8 py-2">
        <div className="yz-skeleton h-[340px] rounded-2xl" />
        <GridSkeleton count={6} />
      </div>
    );
  }

  const hero = data.hero[heroIdx % Math.max(1, data.hero.length)];
  const heroMeta = hero ? categoryMeta(hero.category) : null;

  return (
    <div className="space-y-9 pb-6">
      {/* ── Hero ── */}
      {hero && (
        <section className="hero-aurora relative overflow-hidden rounded-2xl border border-border card-ring-lg">
          { }
          <img
            src={hero.bannerUrl || hero.coverUrl || HERO_IMAGES[heroIdx % HERO_IMAGES.length]}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B1622] via-[#0B1622]/85 to-[#0B1622]/30" />
          <div className="relative grid gap-6 p-6 sm:p-9 md:grid-cols-[1.15fr_0.85fr] md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: `${heroMeta!.hub}22`, color: heroMeta!.hub }}>
                  {heroMeta!.label} Spotlight
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-foreground/80">18+</span>
              </div>
              <h1 className="mt-3 font-display text-4xl leading-tight text-white sm:text-5xl lg:text-[56px]">
                {hero.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                {hero.year && <span>{hero.year}</span>}
                {hero.format && <span>· {hero.format}</span>}
                {hero.status && <span>· {hero.status === "ONGOING" ? "Ongoing" : "Completed"}</span>}
                {hero.rating > 0 && <span className="font-semibold" style={{ color: heroMeta!.hub }}>★ {hero.rating.toFixed(1)}</span>}
              </div>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-foreground/80 line-clamp-3">
                {hero.description}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button size="lg" className="h-12 rounded-2xl cta-gradient border-0 px-7 text-[15px] font-bold" onClick={() => navigate(`/media/${hero.slug}`)}>
                  <Play className="mr-1.5 h-4.5 w-4.5 fill-current" /> {heroMeta!.action}
                </Button>
                <Button size="lg" variant="ghost" className="h-12 rounded-2xl border border-white/15 bg-white/10 px-5 text-[15px] font-semibold text-white hover:bg-white/15" onClick={() => navigate(`/media/${hero.slug}`)}>
                  <Info className="mr-1.5 h-4.5 w-4.5" /> Details
                </Button>
              </div>
            </div>

            {/* poster fan */}
            <div className="relative hidden h-[260px] md:block" aria-hidden>
              {data.hero.slice(0, 5).map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => setHeroIdx(i)}
                  className={cn(
                    "absolute bottom-0 w-[150px] overflow-hidden rounded-xl card-ring transition-all duration-500 hover:z-20 hover:-translate-y-3",
                    i === heroIdx % data.hero.length ? "z-10 scale-105" : "opacity-80"
                  )}
                  style={{
                    left: `${8 + i * 17}%`,
                    transform: `rotate(${(i - 2) * 4}deg)`,
                    zIndex: i === heroIdx % data.hero.length ? 10 : 5 - Math.abs(i - 2),
                  }}
                >
                  { }
                  <img src={m.coverUrl ?? ""} alt="" className="aspect-[2/3] w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Continue ── */}
      {user && data.continue.length > 0 && (
        <Section title="Continue where you left off" icon={<Clock className="h-4.5 w-4.5" />} href="/library">
          <MediaRail items={data.continue.map((c) => fromDTO(c.media))} />
        </Section>
      )}

      {/* ── Trending per category tabs ── */}
      <Section title="Trending this week" icon={<Sparkles className="h-4.5 w-4.5" />} href="/browse/ANIME">
        <CategoryTabs categories={data.categories} />
      </Section>

      {/* ── Category shortcuts ── */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => navigate(`/browse/${c.key}`)}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg press-scale"
              style={{ ["--hub" as string]: c.hub }}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hub-soft" style={{ color: c.hub }}>
                <c.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-bold">{c.label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {data.categories[c.key]?.length ?? 0}+ titles
                </span>
              </span>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </section>

      {/* ── Popular all-time grid ── */}
      <Section title="Popular right now" icon={<Users className="h-4.5 w-4.5" />} href="/browse/ANIME">
        <MediaGrid items={data.popular.slice(0, 12)} />
      </Section>

      {/* ── Stats strip ── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Titles", value: data.stats.media, icon: BookOpen },
          { label: "Providers", value: data.stats.providers, icon: Puzzle },
          { label: "Chapters", value: data.stats.chapters, icon: BookMarked },
          { label: "Episodes", value: data.stats.episodes, icon: Tv },
          { label: "Gallery images", value: data.stats.galleryImages, icon: ImageIcon },
          { label: "Characters", value: data.stats.characters, icon: ScrollText },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <s.icon className="mx-auto h-4.5 w-4.5 text-muted-foreground" />
            <p className="mt-1.5 font-display text-2xl text-white">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Section({ title, icon, href, children }: { title: string; icon?: React.ReactNode; href?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          {icon && <span className="text-[#3DB4F2]">{icon}</span>}
          {title}
        </h2>
        {href && (
          <a href={`#${href}`} className="flex items-center gap-0.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-[#3DB4F2]">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {children}
    </section>
  );
}

function CategoryTabs({ categories }: { categories: Record<string, MediaDTO[]> }) {
  const keys = Object.keys(categories).filter((k) => categories[k]?.length);
  const [active, setActive] = useState(keys[0] ?? "ANIME");
  const meta = categoryMeta(active);
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
      <div style={{ ["--hub" as string]: meta.hub }}>
        <MediaRail items={(categories[active] ?? []).map(fromDTO)} showRank />
      </div>
    </div>
  );
}
