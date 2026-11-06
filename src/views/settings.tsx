"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Settings, LogIn, UserPlus, LogOut, Loader2, MoonStar, ShieldCheck, HardDrive, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers";
import { post } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  const { user, login, register, demoLogin, logout } = useAuth();
  const qc = useQueryClient();
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regDisplayName, setRegDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const [hideCategories, setHideCategories] = useState<string[]>([]);
  const [defaultReaderMode, setDefaultReaderMode] = useState("webtoon");

  // hydrate device-local preferences once on mount
  useEffect(() => {
    const prefs = readPrefs();
    if (prefs.readerMode) setDefaultReaderMode(prefs.readerMode);
    if (Array.isArray(prefs.hideCategories)) setHideCategories(prefs.hideCategories);
  }, []);

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

  const doLogin = async () => {
    setBusy(true);
    try {
      await login(loginUsername, loginPassword);
      toast.success("Welcome back!");
      void qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    setBusy(true);
    try {
      await register(regUsername, regPassword, regDisplayName || undefined);
      toast.success("Account created — welcome to Yozora!");
      void qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6C8299]/20 text-[#9FADBD]">
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl text-white">Settings</h1>
          <p className="text-[13px] text-muted-foreground">Account, content preferences and data</p>
        </div>
      </div>

      {user ? (
        <Tabs defaultValue="account" className="mt-2">
          <TabsList className="flex-wrap gap-1 rounded-xl bg-card">
            <TabsTrigger value="account" className="rounded-lg">Account</TabsTrigger>
            <TabsTrigger value="content" className="rounded-lg">Content</TabsTrigger>
            <TabsTrigger value="data" className="rounded-lg">Data</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-5 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-4">
                {user.avatarUrl && (
                  <img src={user.avatarUrl} alt="" className="h-14 w-14 rounded-xl" />
                )}
                <div>
                  <p className="font-bold">{user.displayName}</p>
                  <p className="text-[13px] text-muted-foreground">@{user.username} · {user.isDemo ? "demo account" : "full account"}</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#3BD47A]/15 px-3 py-1 text-[11px] font-bold text-[#3BD47A]">
                  <ShieldCheck className="h-3.5 w-3.5" /> Age verified
                </span>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" className="gap-1.5 rounded-lg border-border text-[#EF5B6B] hover:bg-[#EF5B6B]/10 hover:text-[#EF5B6B]" onClick={() => void logout().then(() => toast("Signed out"))}>
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
            </div>
            {user.isDemo && (
              <p className="rounded-xl border border-[#FFBE4A]/25 bg-[#FFBE4A]/10 p-4 text-[13px] text-foreground/85">
                You&apos;re on the shared <strong>demo account</strong>. Register a personal account to keep
                your library, progress and collections private.
              </p>
            )}
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
                        ? "border-[#3DB4F2] bg-[#3DB4F2]/15 text-[#3DB4F2]"
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
      ) : (
        /* ── Auth forms ── */
        <div className="mx-auto mt-4 max-w-md">
          <div className="mb-5 rounded-xl border border-[#3DB4F2]/25 bg-[#3DB4F2]/10 p-4 text-center">
            <MoonStar className="mx-auto h-7 w-7 text-[#3DB4F2]" />
            <p className="mt-2 font-bold">Sign in to sync everything</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Library, progress, collections and reviews.</p>
            <Button className="mt-3 w-full rounded-xl border-0 text-[#04121E]" style={{ background: "#3DB4F2" }} onClick={() => void demoLogin().then(() => toast.success("Signed in as demo reader"))}>
              Continue as demo reader
            </Button>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-card">
              <TabsTrigger value="login" className="gap-1.5 rounded-lg"><LogIn className="h-3.5 w-3.5" /> Sign in</TabsTrigger>
              <TabsTrigger value="register" className="gap-1.5 rounded-lg"><UserPlus className="h-3.5 w-3.5" /> Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4 space-y-3 rounded-xl border border-border bg-card p-5">
              <div>
                <Label>Username</Label>
                <Input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="demo" className="mt-1 rounded-lg bg-background" />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="demo1234" className="mt-1 rounded-lg bg-background" onKeyDown={(e) => e.key === "Enter" && doLogin()} />
              </div>
              <Button className="w-full rounded-xl border-0 text-[#04121E]" style={{ background: "#3DB4F2" }} disabled={busy} onClick={doLogin}>
                {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Sign in
              </Button>
              <p className="text-center text-xs text-muted-foreground">Demo credentials: <span className="font-mono">demo / demo1234</span></p>
            </TabsContent>

            <TabsContent value="register" className="mt-4 space-y-3 rounded-xl border border-border bg-card p-5">
              <div>
                <Label>Username</Label>
                <Input value={regUsername} onChange={(e) => setRegUsername(e.target.value)} placeholder="3–24 chars, a-z 0-9 _" className="mt-1 rounded-lg bg-background" />
              </div>
              <div>
                <Label>Display name (optional)</Label>
                <Input value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)} className="mt-1 rounded-lg bg-background" />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="min. 6 characters" className="mt-1 rounded-lg bg-background" onKeyDown={(e) => e.key === "Enter" && doRegister()} />
              </div>
              <Button className="w-full rounded-xl border-0 text-[#04121E]" style={{ background: "#3BD47A" }} disabled={busy} onClick={doRegister}>
                {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Create account
              </Button>
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                By registering you confirm you are 18+ and accept the content policy.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
