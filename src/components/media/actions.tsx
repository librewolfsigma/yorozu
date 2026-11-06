"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Library as LibraryIcon, Heart, FolderPlus, Flag, Star, Trash2, Download,
  Loader2, Check, ChevronDown, ExternalLink,
} from "lucide-react";
import { api, post, patch, del } from "@/lib/client-api";
import { useAuth } from "@/components/providers";
import { LIBRARY_STATUSES } from "@/lib/category-meta";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useHashRoute } from "@/hooks/use-hash-route";

export interface LibraryState {
  status: string;
  progress: number;
  score: number | null;
  favorite: boolean;
  notes: string | null;
}

export function useLibraryMutation(mediaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post("/api/library", { mediaId, ...payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["media", mediaId] });
      void qc.invalidateQueries({ queryKey: ["library"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (e: Error) => toast.error("Library update failed", { description: e.message }),
  });
}

export function AddToLibraryButton({ mediaId, library, hub }: { mediaId: string; library: LibraryState | null; hub: string }) {
  const { user, demoLogin } = useAuth();
  const { navigate } = useHashRoute();
  const mutation = useLibraryMutation(mediaId);

  if (!user) {
    return (
      <Button
        variant="ghost"
        className="rounded-2xl border border-white/15 bg-white/10 font-semibold text-white hover:bg-white/15"
        onClick={() => void demoLogin().then(() => toast.success("Signed in as demo reader"))}
      >
        <LibraryIcon className="mr-1.5 h-4 w-4" /> Add to library
      </Button>
    );
  }

  const statusLabel = library ? LIBRARY_STATUSES.find((s) => s.key === library.status)?.label ?? library.status : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="rounded-2xl border-0 font-semibold"
          style={{ background: `${hub}1f`, color: hub }}
        >
          <LibraryIcon className="mr-1.5 h-4 w-4" />
          {statusLabel ?? "Add to library"}
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 rounded-xl border-border">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Library status</DropdownMenuLabel>
        {LIBRARY_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s.key}
            onClick={() => mutation.mutate({ status: s.key })}
            className="gap-2"
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {library?.status === s.key && <Check className="h-3.5 w-3.5" style={{ color: hub }} />}
            </span>
            {s.label}
          </DropdownMenuItem>
        ))}
        {library && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-[#EF5B6B] focus:text-[#EF5B6B]"
              onClick={() => mutation.mutate({ remove: true })}
            >
              <Trash2 className="h-4 w-4" /> Remove from library
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FavoriteButton({ mediaId, favorite, hub }: { mediaId: string; favorite: boolean; hub: string }) {
  const { user } = useAuth();
  const mutation = useLibraryMutation(mediaId);
  return (
    <button
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full border transition-all press-scale",
        favorite ? "border-transparent" : "border-white/15 bg-white/10 text-white hover:bg-white/15"
      )}
      style={favorite ? { background: `${hub}25`, color: hub } : undefined}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      onClick={() => user && mutation.mutate({ favorite: !favorite })}
      title={user ? undefined : "Sign in to favorite"}
    >
      <Heart className={cn("h-4.5 w-4.5", favorite && "fill-current")} />
    </button>
  );
}

export function CollectionPicker({ mediaId, hub, collections }: {
  mediaId: string;
  hub: string;
  collections: { id: string; name: string; hasItem: boolean }[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createAndAdd = useMutation({
    mutationFn: async () => {
      const res = await post<{ collection: { id: string } }>("/api/collections", { name });
      return post(`/api/collections/${res.collection.id}/items`, { mediaId });
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      setName("");
      setOpen(false);
      toast.success("Added to new collection");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async (c: { id: string; hasItem: boolean }) => {
      if (c.hasItem) return del(`/api/collections/${c.id}/items?mediaId=${mediaId}`);
      return post(`/api/collections/${c.id}/items`, { mediaId });
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Collection updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        className="rounded-2xl border border-white/15 bg-white/10 font-semibold text-white hover:bg-white/15"
        style={{ ["--hub" as string]: hub }}
        onClick={() => setOpen(true)}
      >
        <FolderPlus className="mr-1.5 h-4 w-4" /> Collection
      </Button>
      <DialogContent className="max-w-sm rounded-2xl border-border bg-card" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add to collection</DialogTitle>
        </DialogHeader>
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {collections.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No collections yet — create one below.</p>
          )}
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle.mutate(c)}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-white/5"
            >
              {c.name}
              {c.hasItem ? (
                <Check className="h-4 w-4" style={{ color: hub }} />
              ) : (
                <span className="text-xs text-muted-foreground">Add</span>
              )}
            </button>
          ))}
        </div>
        <div className="border-t border-border pt-3">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" className="rounded-lg bg-background" />
            <Button
              className="shrink-0 rounded-lg border-0 text-[#04121E]"
              style={{ background: hub }}
              disabled={!name.trim() || createAndAdd.isPending}
              onClick={() => createAndAdd.mutate()}
            >
              {createAndAdd.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReportDialog({ targetType, targetId }: { targetType: string; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Illegal content");
  const [details, setDetails] = useState("");
  const submit = useMutation({
    mutationFn: () => post("/api/reports", { targetType, targetId, reason, details }),
    onSuccess: () => {
      setOpen(false);
      setDetails("");
      toast.success("Report submitted", { description: "Moderators will review it against the content policy." });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => setOpen(true)}>
        <Flag className="h-3.5 w-3.5" /> Report
      </Button>
      <DialogContent className="max-w-md rounded-2xl border-border bg-card" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Report content</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Report content that violates the platform policy: underage or ambiguous-age depictions,
          non-consensual scenarios, or illegal material. All reports go to moderation.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1 rounded-lg bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Illegal content">Illegal content</SelectItem>
                <SelectItem value="Underage or ambiguous-age depiction">Underage or ambiguous-age depiction</SelectItem>
                <SelectItem value="Non-consensual scenario">Non-consensual scenario</SelectItem>
                <SelectItem value="Wrong metadata">Wrong metadata</SelectItem>
                <SelectItem value="Broken provider source">Broken provider source</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Details (optional)</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Add context for the moderators…" className="mt-1 rounded-lg bg-background" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="rounded-lg border-0 text-[#04121E]" style={{ background: "#3DB4F2" }} disabled={submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DownloadButton({ mediaId, label, kind, sizeBytes, hub }: {
  mediaId: string; label: string; kind: string; sizeBytes?: number; hub: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => post("/api/downloads", { mediaId, label, kind, sizeBytes }),
    onSuccess: () => {
      toast.success("Download queued", { description: `${label} — track it in Downloads.` });
      void qc.invalidateQueries({ queryKey: ["downloads"] });
    },
    onError: (e: Error) => {
      if (e.message.includes("Sign in")) {
        toast.error("Sign in required", { description: "Create an account or use the demo login to download." });
      } else {
        toast.error(e.message);
      }
    },
  });
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 rounded-lg font-semibold"
      style={{ color: hub, background: `${hub}14` }}
      onClick={() => {
        if (!user) {
          toast.error("Sign in required", { description: "Create an account or use the demo login first." });
          return;
        }
        mutation.mutate();
      }}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Download
    </Button>
  );
}

export function ReviewSection({ mediaId, reviews, hub, rating, ratingCount }: {
  mediaId: string;
  reviews: { id: string; score: number; title: string | null; body: string | null; createdAt: string; user: { username: string; displayName: string; avatarUrl: string | null }; isMine: boolean }[];
  hub: string;
  rating: number;
  ratingCount: number;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [score, setScore] = useState("8");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const mine = reviews.find((r) => r.isMine);

  const submit = useMutation({
    mutationFn: () => post("/api/reviews", { mediaId, score: Number(score), title, body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["media", mediaId] });
      toast.success(mine ? "Review updated" : "Review posted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => del(`/api/reviews?mediaId=${mediaId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["media", mediaId] });
      toast.success("Review deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="font-display text-4xl" style={{ color: hub }}>{rating.toFixed(1)}</span>
        <div>
          <div className="flex gap-0.5" aria-label={`Average rating ${rating} out of 10`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={cn("h-4 w-4", i < Math.round(rating / 2) ? "fill-[#FFBE4A] text-[#FFBE4A]" : "text-muted-foreground")} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{ratingCount} community ratings</p>
        </div>
      </div>

      {user ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-24">
              <Label className="text-xs text-muted-foreground">Your score</Label>
              <Select value={score} onValueChange={setScore}>
                <SelectTrigger className="mt-1 h-9 rounded-lg bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{10 - i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Review title" className="h-9 flex-1 rounded-lg bg-background" />
          </div>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share your thoughts (all characters discussed are fictional adults)…" className="mt-2 min-h-20 rounded-lg bg-background" />
          <div className="mt-2 flex justify-end gap-2">
            {mine && (
              <Button variant="ghost" size="sm" className="text-[#EF5B6B]" onClick={() => remove.mutate()}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete mine
              </Button>
            )}
            <Button size="sm" className="rounded-lg border-0 text-[#04121E]" style={{ background: hub }} disabled={submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mine ? "Update review" : "Post review"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Sign in to write a review.
        </p>
      )}

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2.5">
              {r.user.avatarUrl ? (
                 
                <img src={r.user.avatarUrl} alt="" className="h-8 w-8 rounded-lg" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-bold">{r.user.username.slice(0, 1).toUpperCase()}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{r.user.displayName}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${hub}1a`, color: hub }}>
                {r.score}/10
              </span>
            </div>
            {r.title && <p className="mt-2.5 text-[13.5px] font-bold">{r.title}</p>}
            {r.body && <p className="mt-1 text-[13.5px] leading-relaxed text-foreground/85">{r.body}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProviderChips({ providers, links }: {
  providers: { id: string; name: string; status: string }[];
  links: { providerId: string; externalUrl: string | null }[];
}) {
  const { navigate } = useHashRoute();
  if (providers.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground">Available from</span>
      {providers.map((p) => {
        const link = links.find((l) => l.providerId === p.id);
        return (
          <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold">
            <span className={cn("h-1.5 w-1.5 rounded-full", p.status === "ACTIVE" ? "bg-[#3BD47A]" : p.status === "ERROR" ? "bg-[#EF5B6B]" : "bg-muted")} />
            {p.name}
            {link?.externalUrl && (
              <a href={link.externalUrl} target="_blank" rel="noreferrer" aria-label={`Open ${p.name} listing`} className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button className="text-muted-foreground underline-offset-2 hover:underline" onClick={() => navigate(`/source/${p.id}`)}>
              browse
            </button>
          </span>
        );
      })}
    </div>
  );
}
