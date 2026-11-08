"use client";

// App shell — rebuilt in the Aniyomi/Mihon-client idiom (user directive:
// "change it completely"): a NAVIGATION-DRAWER app, not a marketing website.
//  - Desktop: fixed left sidebar (logo, primary nav, content sections,
//    utility links at the bottom) + slim top bar with search/notifications.
//  - Mobile: compact top app bar (screen title + actions) + bottom tabs
//    (Home · Library · History · Browse · More) + More action sheet.
//  - No marketing footer — a single slim status line closes the page.

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Bell, MoonStar, Home, Library, Layers, History, Compass, MoreHorizontal,
  Puzzle, User, Settings, ShieldCheck, FileCode2, Database,
  ChevronDown, ChevronRight, Sparkles, Image as ImageIcon, Images, Video, Tv, BookOpen, Heart,
  ScrollText, Gamepad2, X,
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

// Screen titles for the mobile app bar (Aniyomi shows the screen name).
const SCREEN_TITLES: [RegExp, string][] = [
  [/^\/$/, "Home"],
  [/^\/library/, "Library"],
  [/^\/history/, "History"],
  [/^\/browse\/?$/, "Browse"],
  [/^\/browse\/AV/, "Video"],
  [/^\/browse\/ANIME/, "Anime"],
  [/^\/browse\/MANGA/, "Manga"],
  [/^\/browse\/DOUJIN/, "Doujin"],
  [/^\/browse\/MANHWA/, "Manhwa"],
  [/^\/browse\/ILLUSTRATION/, "Images (Booru)"],
  [/^\/browse\/GALLERY/, "Image Collections"],
  [/^\/browse\/GAME/, "Games"],
  [/^\/browse\/SCRIPT/, "Scripts"],
  [/^\/browse\/DATABASE/, "Databases"],
  [/^\/browse\/MISC/, "Miscellaneous"],
  [/^\/browse/, "Browse"],
  [/^\/sources/, "Sources"],
  [/^\/source\//, "Source"],
  [/^\/extensions/, "Extensions"],
  [/^\/scripts/, "Scripts"],
  [/^\/databases/, "Databases"],
  [/^\/collections/, "Collections"],
  [/^\/search/, "Search"],
  [/^\/profile/, "Profile"],
  [/^\/settings/, "Settings"],
  [/^\/policy/, "Content policy"],
];

function screenTitle(path: string): string {
  for (const [re, label] of SCREEN_TITLES) if (re.test(path)) return label;
  return "Yozora";
}

function isActive(currentPath: string, itemPath: string): boolean {
  if (itemPath === "/") return currentPath === "/";
  return currentPath === itemPath || currentPath.startsWith(itemPath + "/");
}

// ─── Sidebar nav item ────────────────────────────────────────────────────────

function SideItem({ href, icon: Icon, label, active, badge }: {
  href: string; icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; badge?: string;
}) {
  return (
    <a
      href={`#${href}`}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors",
        active
          ? "bg-white/[0.07] text-primary"
          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("h-[18px] w-[18px]", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      {label}
      {badge && (
        <span className="ml-auto rounded-full bg-white/5 px-1.5 py-0.5 text-[9.5px] font-bold text-muted-foreground">{badge}</span>
      )}
    </a>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-4 px-3 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export function Shell({ children }: { children: React.ReactNode }) {
  const { route } = useHashRoute();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  const title = screenTitle(route.path);

  return (
    <div className="min-h-screen">
      {/* ── Desktop sidebar (Mihon/Aniyomi navigation drawer) ── */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-border bg-[#1C1D22]/95 lg:flex"
        aria-label="Sidebar"
      >
        <a href="#/" className="flex items-center gap-2 px-4 pb-3 pt-5 press-scale" aria-label="Yozora home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg cta-gradient">
            <MoonStar className="h-4.5 w-4.5 text-white" />
          </span>
          <span className="font-display text-2xl leading-none text-white">Yozora</span>
          <span className="ml-auto rounded-full bg-[#EF5B6B]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#FF8B96]">18+</span>
        </a>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 no-scrollbar" aria-label="Primary">
          <SideItem href="/" icon={Home} label="Home" active={isActive(route.path, "/")} />
          <SideItem href="/library" icon={Library} label="Library" active={isActive(route.path, "/library")} />
          <SideItem href="/history" icon={History} label="History" active={isActive(route.path, "/history")} />
          <SideItem href="/browse" icon={Compass} label="Browse" active={route.path === "/browse"} />
          <SideItem href="/sources" icon={Puzzle} label="Sources" active={isActive(route.path, "/sources") || isActive(route.path, "/source/")} />

          <SectionLabel>Content</SectionLabel>
          <SideItem href="/browse/ANIME" icon={Tv} label="Anime" active={isActive(route.path, "/browse/ANIME")} />
          <SideItem href="/browse/MANGA" icon={BookOpen} label="Manga" active={isActive(route.path, "/browse/MANGA")} />
          <SideItem href="/browse/DOUJIN" icon={Heart} label="Doujin" active={isActive(route.path, "/browse/DOUJIN")} />
          <SideItem href="/browse/MANHWA" icon={ScrollText} label="Manhwa" active={isActive(route.path, "/browse/MANHWA")} />

          {/* Video ▾ — AV + its distinct subcategories */}
          <VideoDropdown active={isActive(route.path, "/browse/AV")} />

          {/* Images ▾ — single booru images vs collections DISTINCT */}
          <ImagesDropdown active={isActive(route.path, "/browse/ILLUSTRATION") || isActive(route.path, "/browse/GALLERY")} />

          <SideItem href="/browse/GAME" icon={Gamepad2} label="Games" active={isActive(route.path, "/browse/GAME")} />

          <SectionLabel>Platform</SectionLabel>
          <SideItem href="/extensions" icon={Puzzle} label="Extensions" active={isActive(route.path, "/extensions")} />
          <SideItem href="/scripts" icon={FileCode2} label="Scripts" active={isActive(route.path, "/scripts")} />
          <SideItem href="/databases" icon={Database} label="Databases" active={isActive(route.path, "/databases")} />
          <SideItem href="/collections" icon={Layers} label="Collections" active={isActive(route.path, "/collections")} />
        </nav>

        <div className="border-t border-border px-2 py-2">
          <SideItem href="/settings" icon={Settings} label="Settings" active={isActive(route.path, "/settings")} />
          <SideItem href="/policy" icon={ShieldCheck} label="Content policy" active={isActive(route.path, "/policy")} />
          {user && <SideItem href="/profile" icon={User} label="Profile" active={isActive(route.path, "/profile")} />}
        </div>
      </aside>

      {/* ── Top bar ── */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg lg:left-[232px]">
        {/* mobile: screen title · desktop: search + actions */}
        <div className="flex h-[52px] items-center gap-2 px-4 lg:h-[56px] lg:px-6">
          <a href="#/" className="flex items-center gap-2 lg:hidden" aria-label="Yozora home">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg cta-gradient">
              <MoonStar className="h-4 w-4 text-white" />
            </span>
            <span className="font-display text-xl leading-none text-white">{title}</span>
          </a>

          {/* desktop inline search */}
          <button
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-border bg-white/5 px-3 text-sm text-muted-foreground transition-colors hover:bg-white/10 max-lg:ml-auto max-lg:h-9 max-lg:w-9 max-lg:justify-center max-lg:px-0 lg:ml-4"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Search everything…</span>
            <kbd className="hidden md:inline-flex rounded border border-border bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Ctrl K</kbd>
          </button>

          {user && <NotificationBell />}
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
            <Button type="submit" size="sm" className="rounded-lg bg-primary font-bold text-primary-foreground hover:bg-[#4648B8] hover:text-white">
              Go
            </Button>
          </form>
          <div className="p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jump to category</p>
            <div className="flex flex-wrap gap-2">
              {["ANIME", "MANGA", "DOUJIN", "MANHWA", "ILLUSTRATION", "GALLERY", "AV", "GAME", "SCRIPT", "DATABASE", "MISC"].map((c) => (
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
      <main className="lg:pl-[232px]">
        <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-[68px] lg:px-7 lg:pt-[76px]">{children}</div>
        {/* slim status line — replaces the marketing footer */}
        <div className="mx-auto w-full max-w-[1240px] px-4 pb-24 lg:px-7 lg:pb-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-[11.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold">
              <MoonStar className="h-3 w-3" /> Yozora
            </span>
            <span>Universal 18+ client · content fetched live from installed providers</span>
            <a href="#/policy" className="hover:text-foreground">Content policy</a>
            <a href="#/extensions" className="hover:text-foreground">Extensions</a>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#EF5B6B]/15 px-2 py-0.5 font-bold text-[#FF8B96]">
              <ShieldCheck className="h-3 w-3" /> 18+ ONLY
            </span>
          </div>
        </div>
      </main>

      {/* ── Mobile bottom tabbar — Aniyomi structure ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-stretch justify-around border-t border-border bg-[#1C1D22]/95 backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Mobile"
      >
        {[
          { path: "/", label: "Home", icon: Home },
          { path: "/library", label: "Library", icon: Library },
          { path: "/history", label: "History", icon: History },
          { path: "/browse", label: "Browse", icon: Compass },
        ].map((item) => {
          const active = isActive(route.path, item.path);
          return (
            <a
              key={item.label}
              href={`#${item.path}`}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold",
                active ? "hub-text" : "text-muted-foreground"
              )}
              style={{ ["--hub" as string]: "var(--primary)" }}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </a>
          );
        })}
        <a
          href="#/more"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold",
            isActive(route.path, "/more") || isActive(route.path, "/profile") || isActive(route.path, "/settings") || isActive(route.path, "/collections") || isActive(route.path, "/scripts") || isActive(route.path, "/databases") || isActive(route.path, "/policy")
              ? "hub-text"
              : "text-muted-foreground",
          )}
          style={{ ["--hub" as string]: "var(--primary)" }}
          aria-label="More"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </a>
      </nav>
    </div>
  );
}

// ─── More screen (Mihon "More" tab — settings-style list) ───────────────────

const MORE_SECTIONS: { label: string; items: { label: string; icon: React.ComponentType<{ className?: string }>; href: string; desc: string }[] }[] = [
  {
    label: "Library & tracking",
    items: [
      { label: "Collections", icon: Layers, href: "/collections", desc: "Your own curated sets across every source" },
      { label: "Profile", icon: User, href: "/profile", desc: "Local profile — this device, no account" },
    ],
  },
  {
    label: "Sources",
    items: [
      { label: "Extensions", icon: Puzzle, href: "/extensions", desc: "Install, configure and health-check providers" },
      { label: "Scripts", icon: FileCode2, href: "/scripts", desc: "Userscripts & tools directory" },
      { label: "Databases", icon: Database, href: "/databases", desc: "Metadata database directory" },
    ],
  },
  {
    label: "About",
    items: [
      { label: "Settings", icon: Settings, href: "/settings", desc: "Playback, reader and content preferences" },
      { label: "Content policy", icon: ShieldCheck, href: "/policy", desc: "What Yozora allows — and what it never hosts" },
    ],
  },
];

export function MoreView() {
  return (
    <div className="pb-6">
      <h1 className="font-display text-3xl text-white">More</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Everything that isn't browsing — the Mihon "More" screen.
      </p>
      {MORE_SECTIONS.map((s) => (
        <section key={s.label} className="mt-6">
          <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">{s.label}</p>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {s.items.map((m, i) => (
              <a
                key={m.label}
                href={`#${m.href}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.04]",
                  i > 0 && "border-t border-border",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground">
                  <m.icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-foreground">{m.label}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{m.desc}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Video dropdown (sidebar) ────────────────────────────────────────────────

function VideoDropdown({ active }: { active: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors",
            active ? "bg-white/[0.07] text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
          )}
          aria-expanded="false"
        >
          <Video className="h-[18px] w-[18px]" />
          Video
          <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-56 rounded-xl border-border">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Images dropdown (sidebar) ───────────────────────────────────────────────

function ImagesDropdown({ active }: { active: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors",
            active ? "bg-white/[0.07] text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
          )}
          aria-expanded="false"
        >
          <ImageIcon className="h-[18px] w-[18px]" />
          Images
          <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-60 rounded-xl border-border">
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
      </DropdownMenuContent>
    </DropdownMenu>
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
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-muted" : "bg-primary yz-pulse-dot"}`}
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
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
          )}
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
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
