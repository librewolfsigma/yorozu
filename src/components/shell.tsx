"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Bell, MoonStar, Home, Compass, Library, Layers, History,
  Puzzle, User, Settings, ShieldCheck,
  ChevronDown, Sparkles, Image as ImageIcon, Images, Video,
} from "lucide-react";
import { useAuth } from "@/components/providers";
import { navigate, useHashRoute } from "@/hooks/use-hash-route";
import { api, post } from "@/lib/client-api";
import { timeAgo, categoryMeta, VIDEO_KINDS } from "@/lib/category-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string; type: string; title: string; body: string | null;
  link: string | null; read: boolean; createdAt: string;
}

// TAXONOMY in the nav: every category is reachable in one click (dropdown or
// direct) — Manga, Doujin and Manhwa are distinct entries; single booru images
// and image collections are distinct entries; AV subkinds live under Video.
const NAV_CATEGORIES = ["ANIME", "MANGA", "DOUJIN", "MANHWA", "ILLUSTRATION", "GALLERY", "AV", "GAME", "SCRIPT", "DATABASE", "MISC"];

function isActive(currentPath: string, itemPath: string): boolean {
  if (itemPath === "/") return currentPath === "/";
  return currentPath === itemPath || currentPath.startsWith(itemPath + "/");
}

function CategoryDropdown({ label, active, children }: {
  label: string; active: boolean; children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold transition-colors",
            active
              ? "hub-soft hub-text"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          {label} <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60 rounded-xl border-border">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CategoryLink({ catKey, onClick }: { catKey: string; onClick?: () => void }) {
  const m = categoryMeta(catKey);
  return (
    <DropdownMenuItem asChild>
      <a
        href={`#/browse/${catKey}`}
        onClick={onClick}
        className="flex cursor-pointer items-center gap-2.5"
      >
        <m.icon className="h-4 w-4" style={{ color: m.hub }} />
        <span className="text-[13px] font-semibold">{m.label}</span>
      </a>
    </DropdownMenuItem>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { route } = useHashRoute();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [headerSolid, setHeaderSolid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setHeaderSolid(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      setSearchOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Header ── */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 h-[60px] border-b transition-colors duration-300",
          headerSolid ? "glass-header border-border" : "border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-full max-w-[1140px] items-center gap-2 px-4 lg:px-5">
          {/* logo */}
          <a href="#/" className="flex items-center gap-2 press-scale" aria-label="Yozora home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg cta-gradient">
              <MoonStar className="h-4.5 w-4.5 text-white" />
            </span>
            <span className="font-display text-2xl leading-none text-white">Yozora</span>
          </a>

          {/* desktop nav — every category reachable in one click */}
          <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            <a
              href="#/"
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold transition-colors",
                isActive(route.path, "/")
                  ? "hub-soft hub-text"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              Home
            </a>

            {/* Video ▾ — AV + its distinct subcategories */}
            <CategoryDropdown label="Video" active={isActive(route.path, "/browse/AV")}>
              <DropdownMenuItem asChild>
                <a href="#/browse/AV" className="flex cursor-pointer items-center gap-2.5">
                  <Video className="h-4 w-4 text-[#FF6F91]" />
                  <span className="text-[13px] font-semibold">All video</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {VIDEO_KINDS.filter((k) => k.key).map((k) => (
                <DropdownMenuItem key={k.key} asChild>
                  <a href={`#/browse/AV?kind=${encodeURIComponent(k.key)}`} className="flex cursor-pointer items-center gap-2.5" title={k.blurb}>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF6F91]" />
                    <span className="text-[13px] font-semibold">{k.label}</span>
                  </a>
                </DropdownMenuItem>
              ))}
            </CategoryDropdown>

            {/* direct reading categories — Manga / Doujin / Manhwa DISTINCT */}
            {[
              { key: "ANIME", label: "Anime" },
              { key: "MANGA", label: "Manga" },
              { key: "DOUJIN", label: "Doujin" },
              { key: "MANHWA", label: "Manhwa" },
            ].map((c) => (
              <a
                key={c.key}
                href={`#/browse/${c.key}`}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold transition-colors",
                  isActive(route.path, `/browse/${c.key}`)
                    ? "hub-soft hub-text"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {c.label}
              </a>
            ))}

            {/* Images ▾ — single booru images vs collections DISTINCT */}
            <CategoryDropdown
              label="Images"
              active={isActive(route.path, "/browse/ILLUSTRATION") || isActive(route.path, "/browse/GALLERY")}
            >
              <DropdownMenuItem asChild>
                <a href="#/browse/ILLUSTRATION" className="flex cursor-pointer items-center gap-2.5">
                  <ImageIcon className="h-4 w-4 text-[#AE8BFF]" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">Images (Booru)</span>
                    <span className="block text-[10.5px] text-muted-foreground">Single posts · tag search · lightbox</span>
                  </span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="#/browse/GALLERY" className="flex cursor-pointer items-center gap-2.5">
                  <Images className="h-4 w-4 text-[#8AE0B0]" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">Image Collections</span>
                    <span className="block text-[10.5px] text-muted-foreground">Curated multi-image sets</span>
                  </span>
                </a>
              </DropdownMenuItem>
            </CategoryDropdown>

            <a
              href="#/browse/GAME"
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold transition-colors",
                isActive(route.path, "/browse/GAME")
                  ? "hub-soft hub-text"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              Games
            </a>

            {/* More ▾ — everything else, one click away */}
            <CategoryDropdown
              label="More"
              active={
                isActive(route.path, "/scripts") || isActive(route.path, "/databases") ||
                isActive(route.path, "/collections") || isActive(route.path, "/history") ||
                isActive(route.path, "/extensions") || isActive(route.path, "/browse/SCRIPT") ||
                isActive(route.path, "/browse/DATABASE") || isActive(route.path, "/browse/MISC")
              }
            >
              <CategoryLink catKey="SCRIPT" />
              <CategoryLink catKey="DATABASE" />
              <CategoryLink catKey="MISC" />
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="#/collections" className="flex cursor-pointer items-center gap-2.5"><Layers className="h-4 w-4" /> <span className="text-[13px] font-semibold">Collections</span></a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="#/history" className="flex cursor-pointer items-center gap-2.5"><History className="h-4 w-4" /> <span className="text-[13px] font-semibold">History</span></a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="#/extensions" className="flex cursor-pointer items-center gap-2.5"><Puzzle className="h-4 w-4" /> <span className="text-[13px] font-semibold">Extensions</span></a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="#/settings" className="flex cursor-pointer items-center gap-2.5"><Settings className="h-4 w-4" /> <span className="text-[13px] font-semibold">Settings</span></a>
              </DropdownMenuItem>
            </CategoryDropdown>
          </nav>

          <div className="flex-1" />

          {/* search */}
          <button
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="ml-1 flex h-9 items-center gap-2 rounded-lg border border-border bg-white/5 px-3 text-sm text-muted-foreground hover:bg-white/10 transition-colors"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Search everything…</span>
            <kbd className="hidden md:inline-flex rounded border border-border bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Ctrl K</kbd>
          </button>

          {/* notifications */}
          {user && <NotificationBell />}

          {/* user — always present: Yozora has no login, just a local profile */}
          <UserMenu />
        </div>
      </header>

      {/* ── Search dialog ── */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl rounded-2xl border-border bg-card p-0" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSearch} className="flex items-center gap-2 border-b border-border p-3">
            <Search className="ml-1 h-4.5 w-4.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search anime, manga, galleries, games…"
              className="h-10 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              aria-label="Search query"
            />
            <Button type="submit" size="sm" className="rounded-lg bg-[#3DB4F2] font-bold text-[#04121E] hover:bg-[#1E97D8] hover:text-white">
              Go
            </Button>
          </form>
          <div className="p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jump to category</p>
            <div className="flex flex-wrap gap-2">
              {NAV_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    navigate(`/browse/${c}`);
                    setSearchOpen(false);
                  }}
                  className="rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/10"
                >
                  {categoryMeta(c).label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Search runs live across all installed providers — nothing is stored locally.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Main ── */}
      <main className="flex-1 pb-20 lg:pb-0">
        <div className="mx-auto w-full max-w-[1140px] px-4 pt-[76px] lg:px-5">{children}</div>
      </main>

      {/* ── Footer (sticky via flex-col + mt-auto handled by min-h-screen flex) ── */}
      <footer className="mt-auto border-t border-border bg-[#151F2E] pb-20 lg:pb-0">
        <div className="mx-auto max-w-[1140px] px-4 py-10 lg:px-5">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg cta-gradient">
                  <MoonStar className="h-4 w-4 text-white" />
                </span>
                <span className="font-display text-xl text-white">Yozora</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                Universal 18+ media platform. Mihon-inspired extensions, AniList-style tracking,
                Hikari-inspired design. Catalog data is fetched live from integrated third-party providers.
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#EF5B6B]/15 px-2.5 py-1 text-[11px] font-bold text-[#FF8B96]">
                <ShieldCheck className="h-3.5 w-3.5" /> 18+ ONLY · AGE VERIFIED
              </p>
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Discover</p>
              <ul className="space-y-2 text-[13px] text-muted-foreground">
                {NAV_CATEGORIES.slice(0, 6).map((c) => (
                  <li key={c}><a className="hover:text-foreground" href={`#/browse/${c}`}>{categoryMeta(c).label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Platform</p>
              <ul className="space-y-2 text-[13px] text-muted-foreground">
                <li><a className="hover:text-foreground" href="#/extensions">Extensions</a></li>
                <li><a className="hover:text-foreground" href="#/scripts">Scripts</a></li>
                <li><a className="hover:text-foreground" href="#/databases">Databases</a></li>
                <li><a className="hover:text-foreground" href="#/settings">Settings</a></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Safety</p>
              <ul className="space-y-2 text-[13px] text-muted-foreground">
                <li><a className="hover:text-foreground" href="#/policy">Content policy</a></li>
                <li><a className="hover:text-foreground" href="#/policy">Report content</a></li>
                <li>
                  <a className="hover:text-foreground inline-flex items-center gap-1" href="https://wotaku.wiki/nsfw" target="_blank" rel="noreferrer">
                    Source research (Wotaku) <Sparkles className="h-3 w-3" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-border pt-5 text-[12px] text-muted-foreground md:flex-row md:items-center">
            <p>© {new Date().getFullYear()} Yozora. All catalog content comes from integrated external providers (see Extensions); Yozora hosts no media files.</p>
            <p>Design inspired by myhikari.in · Architecture inspired by Mihon & AniList</p>
          </div>
        </div>
      </footer>

      {/* ── Mobile bottom tabbar ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-stretch justify-around border-t border-border bg-[#151F2E]/95 backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Mobile"
      >
        {[
          { path: "/", label: "Home", icon: Home },
          { path: "/browse", label: "Browse", icon: Compass },
          { path: "/library", label: "Library", icon: Library },
          { path: "/search", label: "Search", icon: Search, mobileOnly: true },
          { path: "/profile", label: "Profile", icon: User, mobileOnly: true },
        ].map((item) => {
          const active = item.mobileOnly ? route.path === item.path : isActive(route.path, item.path);
          return (
            <a
              key={item.label}
              href={item.mobileOnly && item.path === "/search" ? undefined : `#${item.path}`}
              onClick={
                item.mobileOnly && item.path === "/search"
                  ? (e) => {
                      e.preventDefault();
                      setSearchOpen(true);
                      setTimeout(() => inputRef.current?.focus(), 60);
                    }
                  : undefined
              }
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold",
                active ? "hub-text" : "text-muted-foreground"
              )}
              style={{ ["--hub" as string]: "#3DB4F2" }}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ notifications: NotificationRow[]; unread: number }>("/api/notifications"),
    refetchInterval: 60_000,
  });
  const unread = data?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v && unread > 0) {
        void post("/api/notifications", { all: true }).then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
      }
    }}>
      <PopoverTrigger asChild>
        <button
          className="relative ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        >
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3B5C] px-1 text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 rounded-xl border-border bg-popover p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-bold">Notifications</p>
          <span className="text-xs text-muted-foreground">{unread} unread</span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(data?.notifications ?? []).length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
          )}
          {(data?.notifications ?? []).map((n) => (
            <a
              key={n.id}
              href={n.link ?? "#"}
              onClick={() => setOpen(false)}
              className="block border-b border-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-white/5"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-muted" : "bg-[#3DB4F2] yz-pulse-dot"}`}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug">{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 flex h-9 items-center gap-1.5 rounded-lg pl-1 pr-2 transition-colors hover:bg-white/5" aria-label="Profile menu">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-lg" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3DB4F2] text-xs font-bold text-[#04121E]">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl border-border">
        <DropdownMenuLabel>
          <p className="text-sm font-bold">{user.displayName}</p>
          <p className="text-xs font-normal text-muted-foreground">local profile · this device · no account</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2">
          <User className="h-4 w-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/library")} className="gap-2">
          <Library className="h-4 w-4" /> My library
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2">
          <Settings className="h-4 w-4" /> Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
