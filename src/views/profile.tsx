"use client";

import { useQuery } from "@tanstack/react-query";
import { User, Star, BookOpen, Tv, Image as ImageIcon, Flag, Library } from "lucide-react";
import { api } from "@/lib/client-api";
import { useAuth } from "@/components/providers";
import { MediaGrid, fromDTO, GridSkeleton } from "@/components/media/card";
import { LIBRARY_STATUSES, timeAgo, fmtNumber } from "@/lib/category-meta";
import type { MediaDTO } from "@/lib/serialize";

interface ProfileData {
  library: { entries: { status: string; score: number | null; favorite: boolean; media: MediaDTO }[]; counts: Record<string, number> };
  history: { entries: { action: string; category: string; createdAt: string; titleSnapshot: string | null; mediaSlug: string | null }[] };
  reports: { id: string; targetType: string; reason: string; status: string; createdAt: string }[];
}

export default function ProfileView() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<ProfileData>("/api/profile"),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <User className="h-10 w-10 text-muted-foreground" />
        <p className="mt-4 font-semibold">Sign in to view your profile</p>
        <a href="#/settings" className="mt-4 text-sm font-semibold text-[#3DB4F2] hover:underline">Go to sign in →</a>
      </div>
    );
  }

  const favs = (data?.library.entries ?? []).filter((e) => e.favorite).map((e) => e.media);
  const readCount = (data?.history.entries ?? []).filter((h) => h.action === "READ").length;
  const watchCount = (data?.history.entries ?? []).filter((h) => h.action === "WATCH").length;
  const scores = (data?.library.entries ?? []).filter((e) => e.score != null);
  const meanScore = scores.length ? scores.reduce((a, b) => a + (b.score ?? 0), 0) / scores.length : 0;

  return (
    <div className="pb-6">
      {/* profile header */}
      <div className="hero-aurora relative overflow-hidden rounded-2xl border border-border card-ring p-6 sm:p-8">
        <div className="relative flex flex-wrap items-center gap-5">
          {user.avatarUrl && (
             
            <img src={user.avatarUrl} alt="" className="h-20 w-20 rounded-2xl card-ring object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl text-white">{user.displayName}</h1>
            <p className="text-[13px] text-muted-foreground">@{user.username}{user.isDemo ? " · demo account" : ""} · member since {new Date(user.createdAt).toLocaleDateString()}</p>
            {user.bio && <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-foreground/80">{user.bio}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "In library", value: data?.library.entries.length ?? 0, icon: Library },
              { label: "Ch. read", value: readCount, icon: BookOpen },
              { label: "Ep. watched", value: watchCount, icon: Tv },
              { label: "Mean score", value: meanScore ? meanScore.toFixed(1) : "—", icon: Star },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
                <s.icon className="mx-auto h-4 w-4 text-[#3DB4F2]" />
                <p className="mt-1 font-display text-xl text-white">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* status breakdown */}
      <div className="mt-5 grid grid-cols-5 gap-2">
        {LIBRARY_STATUSES.map((s) => (
          <div key={s.key} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="font-display text-xl text-white">{data?.library.counts?.[s.key] ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* favorites */}
      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-bold">Favorites</h2>
        {isLoading ? <GridSkeleton count={6} /> : favs.length ? (
          <MediaGrid items={favs.map(fromDTO)} />
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Heart a title to feature it here.
          </p>
        )}
      </section>

      {/* recent activity */}
      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-bold">Recent activity</h2>
        <div className="space-y-1.5">
          {(data?.history.entries ?? []).slice(0, 8).map((h) => (
            <div key={h.createdAt} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-[13px]">
              <p className="min-w-0 truncate">
                <span className="font-bold">{h.action.toLowerCase()}</span>
                <span className="text-muted-foreground"> — {h.titleSnapshot ?? h.category.toLowerCase()}</span>
              </p>
              <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(h.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* moderation */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-1.5 text-[15px] font-bold">
          <Flag className="h-4 w-4 text-[#FFBE4A]" /> My reports
        </h2>
        {(data?.reports ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No reports filed. Use the Report button on any title if something violates the content policy.
          </p>
        ) : (
          <div className="space-y-2">
            {(data?.reports ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <p className="font-semibold">{r.reason}</p>
                  <p className="text-[11px] text-muted-foreground">{r.targetType} · {timeAgo(r.createdAt)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
