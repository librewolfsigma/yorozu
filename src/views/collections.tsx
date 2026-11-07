"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layers, Plus, Trash2, Loader2, X } from "lucide-react";
import { api, post, del } from "@/lib/client-api";
import { CoverImg } from "@/components/media/card";
import { useAuth } from "@/components/providers";
import { RefPoster } from "@/views/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/** Snapshot-only item ref — the work itself lives upstream. */
interface CollectionItem {
  provider: string;
  externalId: string;
  ref: string;
  category: string;
  title: string;
  coverUrl: string | null;
  addedAt: string;
}

interface CollectionsResponse {
  collections: {
    id: string; name: string; description: string | null;
    createdAt: string; cover: string | null;
    items: CollectionItem[];
  }[];
}

export default function CollectionsView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: () => api<CollectionsResponse>("/api/collections"),
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: () => post("/api/collections", { name, description: desc }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["collections"] });
      setCreateOpen(false);
      setName("");
      setDesc("");
      toast.success("Collection created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCollection = useMutation({
    mutationFn: (id: string) => del(`/api/collections/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["collections"] });
      setOpenId(null);
      toast.success("Collection deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: ({ colId, item }: { colId: string; item: CollectionItem }) =>
      del(`/api/collections/${colId}/items?provider=${encodeURIComponent(item.provider)}&externalId=${encodeURIComponent(item.externalId)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["collections"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Layers className="h-10 w-10 text-muted-foreground" />
        <p className="mt-4 font-semibold">Collections</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Curate sets of titles — reading lists, moods, rewatch piles. Build your first one right here.
        </p>
      </div>
    );
  }

  const open = data?.collections.find((c) => c.id === openId) ?? null;

  return (
    <div className="pb-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#AE8BFF]/15 text-[#AE8BFF]">
          <Layers className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-3xl text-white">Collections</h1>
          <p className="text-[13px] text-muted-foreground">{data?.collections.length ?? 0} collections</p>
        </div>
        <Button className="gap-1.5 rounded-xl border-0 text-[#04121E]" style={{ background: "#AE8BFF" }} onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New collection
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="yz-skeleton h-44 rounded-xl" />)}
        </div>
      ) : (data?.collections.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-semibold">No collections yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one, then add titles from any detail page.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.collections.map((c) => (
            <button
              key={c.id}
              className="group overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
              onClick={() => setOpenId(c.id)}
            >
              <div className="flex h-24 gap-0.5 overflow-hidden">
                {c.items.slice(0, 3).map((i) => (
                  // snapshot cover — display cache only
                  <CoverImg key={i.ref} src={i.coverUrl} alt="" className="h-full min-w-0 flex-1 object-cover" />
                ))}
                {c.items.length === 0 && <div className="flex h-full flex-1 items-center justify-center bg-muted text-xs text-muted-foreground">Empty</div>}
              </div>
              <div className="p-4">
                <p className="text-[14px] font-bold">{c.name}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.description ?? "No description"}</p>
                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">{c.items.length} titles</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-border bg-card" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>New collection</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Late Night Reads" className="mt-1 rounded-lg bg-background" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What belongs here?" className="mt-1 rounded-lg bg-background" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="rounded-lg border-0 text-[#04121E]" style={{ background: "#AE8BFF" }} disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* detail dialog */}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-2xl rounded-2xl border-border bg-card" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              {open?.name}
              <Button variant="ghost" size="sm" className="gap-1 text-[#EF5B6B] hover:bg-[#EF5B6B]/10 hover:text-[#EF5B6B]" onClick={() => open && removeCollection.mutate(open.id)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete collection
              </Button>
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{open?.description}</p>
          <div className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4">
            {open?.items.map((i) => (
              <div key={i.ref} className="relative">
                <RefPoster work={i} />
                <button
                  className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#EF5B6B] text-white shadow-lg"
                  aria-label={`Remove ${i.title} from collection`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem.mutate({ colId: open.id, item: i });
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          {open?.items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing added yet — use the “Collection” button on any title.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
