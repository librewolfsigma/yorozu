"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Database, Users, UserCog, Tags, BarChart3, Search } from "lucide-react";
import { api } from "@/lib/client-api";
import { navigate } from "@/hooks/use-hash-route";
import { categoryMeta, fmtNumber } from "@/lib/category-meta";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface CharacterData {
  characters: {
    id: string; name: string; description: string | null; imageUrl: string | null;
    media: { id: string; slug: string; title: string; coverUrl: string; category: string; accent: string; role: string | null }[];
  }[];
}
interface PeopleData {
  people: {
    id: string; name: string; kind: string; bio: string | null;
    media: { id: string; slug: string; title: string; coverUrl: string; category: string; accent: string; role: string }[];
  }[];
}
interface TagsData {
  tags: { id: string; name: string; kind: string; description: string | null; count: number }[];
}
interface StatsData {
  byCategory: { category: string; count: number }[];
  totals: Record<string, number>;
  topStudios: { name: string; count: number }[];
}

export default function DatabasesView() {
  const [tab, setTab] = useState("characters");
  const [q, setQ] = useState("");

  const { data: chars } = useQuery({
    queryKey: ["databases", "characters", q],
    queryFn: () => api<CharacterData>(`/api/databases?type=characters&q=${encodeURIComponent(q)}`),
    enabled: tab === "characters",
  });
  const { data: people } = useQuery({
    queryKey: ["databases", "people", q],
    queryFn: () => api<PeopleData>(`/api/databases?type=people&q=${encodeURIComponent(q)}`),
    enabled: tab === "people",
  });
  const { data: tags } = useQuery({
    queryKey: ["databases", "tags", q],
    queryFn: () => api<TagsData>(`/api/databases?type=tags&q=${encodeURIComponent(q)}`),
    enabled: tab === "tags",
  });
  const { data: stats } = useQuery({
    queryKey: ["databases", "stats"],
    queryFn: () => api<StatsData>("/api/databases?type=stats"),
    enabled: tab === "stats",
  });

  return (
    <div className="pb-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C8CFF]/15 text-[#7C8CFF]">
          <Database className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-3xl text-white">Databases</h1>
          <p className="text-[13px] text-muted-foreground">Unified metadata: characters, creators, studios, tags and platform statistics</p>
        </div>
        {(tab === "characters" || tab === "people" || tab === "tags") && (
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="h-9 rounded-lg bg-card pl-8" />
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap gap-1 rounded-xl bg-card">
          <TabsTrigger value="characters" className="gap-1.5 rounded-lg"><Users className="h-3.5 w-3.5" /> Characters</TabsTrigger>
          <TabsTrigger value="people" className="gap-1.5 rounded-lg"><UserCog className="h-3.5 w-3.5" /> Creators & studios</TabsTrigger>
          <TabsTrigger value="tags" className="gap-1.5 rounded-lg"><Tags className="h-3.5 w-3.5" /> Tags</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5 rounded-lg"><BarChart3 className="h-3.5 w-3.5" /> Statistics</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* characters */}
      {tab === "characters" && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(chars?.characters ?? []).map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                {c.imageUrl && (
                   
                  <img src={c.imageUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.media.length} title{c.media.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              {c.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
              <div className="mt-2.5 flex flex-wrap gap-1">
                {c.media.slice(0, 3).map((m) => {
                  const meta = categoryMeta(m.category);
                  return (
                    <button
                      key={m.id}
                      onClick={() => navigate(`/media/${m.slug}`)}
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold transition-transform hover:scale-105"
                      style={{ background: `${m.accent ?? meta.hub}1a`, color: m.accent ?? meta.hub }}
                      title={m.title}
                    >
                      {m.title.length > 22 ? m.title.slice(0, 20) + "…" : m.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* people */}
      {tab === "people" && (
        <div className="mt-6 space-y-6">
          {["STUDIO", "DEVELOPER", "AUTHOR", "ARTIST", "DIRECTOR"].map((kind) => {
            const rows = (people?.people ?? []).filter((p) => p.kind === kind);
            if (rows.length === 0) return null;
            return (
              <div key={kind}>
                <h2 className="mb-2.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                  {kind === "STUDIO" ? "Studios" : kind === "DEVELOPER" ? "Developers" : kind === "AUTHOR" ? "Authors" : kind === "ARTIST" ? "Artists" : "Directors"}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13.5px] font-bold">{p.name}</p>
                        <span className="text-[11px] text-muted-foreground">{p.media.length} works</span>
                      </div>
                      {p.bio && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.bio}</p>}
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {p.media.slice(0, 4).map((m) => (
                          <button
                            key={m.id}
                            onClick={() => navigate(`/media/${m.slug}`)}
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: `${m.accent ?? "#3DB4F2"}1a`, color: m.accent ?? "#3DB4F2" }}
                          >
                            {m.title.length > 18 ? m.title.slice(0, 16) + "…" : m.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* tags */}
      {tab === "tags" && (
        <div className="mt-6 flex flex-wrap gap-2">
          {(tags?.tags ?? []).map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/browse/ANIME?q=${encodeURIComponent(t.name)}`)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                t.kind === "GENRE"
                  ? "border-[#3DB4F2]/40 bg-[#3DB4F2]/10 text-[#3DB4F2] hover:bg-[#3DB4F2]/20"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {t.name} <span className="opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* stats */}
      {tab === "stats" && stats && (
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Titles", stats.byCategory.reduce((a, b) => a + b.count, 0)],
              ["Chapters", stats.totals.chapters],
              ["Reader pages", stats.totals.pages],
              ["Episodes", stats.totals.episodes],
              ["Gallery images", stats.totals.galleryImages],
              ["Characters", stats.totals.characters],
              ["People", stats.totals.people],
              ["Active providers", stats.totals.providers],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="font-display text-2xl text-white">{fmtNumber(Number(value))}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">By category</h3>
              <div className="space-y-2">
                {stats.byCategory.sort((a, b) => b.count - a.count).map((c) => {
                  const meta = categoryMeta(c.category);
                  const max = Math.max(...stats.byCategory.map((x) => x.count));
                  return (
                    <div key={c.category} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-semibold" style={{ color: meta.hub }}>{meta.label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, background: meta.hub }} />
                      </div>
                      <span className="w-8 text-right text-xs font-bold tabular-nums">{c.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Most prolific studios</h3>
              <div className="space-y-2">
                {stats.topStudios.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-3 text-[13px]">
                    <span className="w-5 font-display text-base text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 font-semibold">{s.name}</span>
                    <span className="text-muted-foreground">{s.count} titles</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
