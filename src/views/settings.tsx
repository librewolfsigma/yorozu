"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Settings, ShieldCheck, HardDrive, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api, del } from "@/lib/client-api";
import { CATEGORIES } from "@/lib/category-meta";

// Client-side preference persistence: reader/category prefs live on this
// device only (localStorage) — there is no server settings endpoint to invent.
const PREFS_KEY = "yozora_settings";
interface Prefs {
  readerMode?: string;
  hideCategories?: string[];
}

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : {};
  } catch {
    return {};
  }
}

function writePrefs(next: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...next }));
  } catch {
    // storage unavailable — prefs stay in-memory for this session
  }
}

export default function SettingsView() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // device-local preferences — hydrated lazily from localStorage (client-only)
  const [hideCategories, setHideCategories] = useState<string[]>(() => {
    const prefs = readPrefs();
    return Array.isArray(prefs.hideCategories) ? prefs.hideCategories : [];
  });
  const [defaultReaderMode, setDefaultReaderMode] = useState(() => readPrefs().readerMode ?? "webtoon");

  const chooseReaderMode = (key: string) => {
    setDefaultReaderMode(key);
    writePrefs({ readerMode: key });
  };

  const toggleCategory = (key: string, visible: boolean) => {
    const next = visible
      ? hideCategories.filter((k) => k !== key)
      : [...hideCategories, key];
    setHideCategories(next);
    writePrefs({ hideCategories: next });
  };

  return (
    <div className="pb-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#9BA0B0]/20 text-[#9FADBD]">
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl text-white">Settings</h1>
          <p className="text-[13px] text-muted-foreground">Content preferences and local data</p>
        </div>
      </div>

      <Tabs defaultValue="account" className="mt-2">
        <TabsList className="flex-wrap gap-1 rounded-xl bg-card">
          <TabsTrigger value="account" className="rounded-lg">Profile</TabsTrigger>
          <TabsTrigger value="content" className="rounded-lg">Content</TabsTrigger>
          <TabsTrigger value="data" className="rounded-lg">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-5 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              {user?.avatarUrl && (
                <img src={user.avatarUrl} alt="" className="h-14 w-14 rounded-xl" />
              )}
              <div>
                <p className="font-bold">{user?.displayName ?? "Local viewer"}</p>
                <p className="text-[13px] text-muted-foreground">local profile · this device</p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#3BD47A]/15 px-3 py-1 text-[11px] font-bold text-[#3BD47A]">
                <ShieldCheck className="h-3.5 w-3.5" /> Age verified
              </span>
            </div>
          </div>
          <p className="rounded-xl border border-primary/25 bg-primary/10 p-4 text-[13px] text-foreground/85">
            Yozora has <strong>no accounts and no login</strong>. Your library, progress, collections and
            reviews live on this device under a local profile — nothing to sign up for, nothing to lock.
          </p>
        </TabsContent>

        <TabsContent value="content" className="mt-5 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-[14px] font-bold">Default reader mode</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Applied when opening manga & manhwa chapters (stored on this device).</p>
            <div className="mt-3 flex gap-2">
              {[
                { key: "paged", label: "Paged" },
                { key: "webtoon", label: "Long strip" },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => chooseReaderMode(m.key)}
                  aria-pressed={defaultReaderMode === m.key}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                    defaultReaderMode === m.key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-[14px] font-bold">Category visibility</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Hide categories you&apos;re not interested in (stored locally on this device).</p>
            <div className="mt-3 space-y-2">
              {CATEGORIES.map((c) => (
                <label key={c.key} className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5">
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                    <c.icon className="h-4 w-4" style={{ color: c.hub }} /> {c.label}
                  </span>
                  <Switch
                    checked={!hideCategories.includes(c.key)}
                    onCheckedChange={(v) => toggleCategory(c.key, v)}
                    aria-label={`Show ${c.label}`}
                  />
                </label>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data" className="mt-5 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="flex items-center gap-2 text-[14px] font-bold"><HardDrive className="h-4 w-4" /> Local data</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Clear locally cached queries and stored preferences. Your library, progress and collections are untouched.
            </p>
            <Button
              variant="outline"
              className="mt-3 gap-1.5 rounded-lg border-border"
              onClick={() => {
                localStorage.removeItem("yozora_age");
                localStorage.removeItem(PREFS_KEY);
                qc.clear();
                setDefaultReaderMode("webtoon");
                setHideCategories([]);
                toast.success("Local data cleared");
              }}
            >
              <Trash2 className="h-4 w-4" /> Clear local data
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Yozora is a client, not a database — only your own tracking data is stored, locally in SQLite.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
