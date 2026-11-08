"use client";

import { Suspense, lazy } from "react";
import { AppProviders } from "@/components/providers";
import { Shell } from "@/components/shell";
import { useHashRoute } from "@/hooks/use-hash-route";
import { GridSkeleton } from "@/components/media/card";

// Views are lazy-loaded so the first paint (home) stays fast.
const HomeView = lazy(() => import("@/views/home"));
const BrowseView = lazy(() => import("@/views/browse"));
const SearchView = lazy(() => import("@/views/search"));
const DetailView = lazy(() => import("@/views/detail"));
const ReaderView = lazy(() => import("@/views/reader"));
const WatchView = lazy(() => import("@/views/watch"));
const GalleryView = lazy(() => import("@/views/gallery"));
const LibraryView = lazy(() => import("@/views/library"));
const CollectionsView = lazy(() => import("@/views/collections"));
const HistoryView = lazy(() => import("@/views/history"));
const ExtensionsView = lazy(() => import("@/views/extensions"));
const ScriptsView = lazy(() => import("@/views/scripts"));
const DatabasesView = lazy(() => import("@/views/databases"));
const ProfileView = lazy(() => import("@/views/profile"));
const SettingsView = lazy(() => import("@/views/settings"));
const PolicyView = lazy(() => import("@/views/policy"));
const SourceView = lazy(() => import("@/views/source"));
const SourcesView = lazy(() => import("@/views/sources"));
import { MoreView } from "@/components/shell";

function ViewFallback() {
  return (
    <div className="py-8">
      <GridSkeleton count={12} />
    </div>
  );
}

function Router() {
  const { route } = useHashRoute();
  const seg = route.segments;
  const [head, a] = seg;
  const q = route.query;

  // External refs travel in the query string, URL-encoded:
  // #/media?p=&id= · #/read?p=&id=&ch= · #/watch?p=&id=&ep= · #/gallery?p=&id=
  const provider = q.get("p");
  const id = q.get("id");

  // full-bleed views manage their own chrome
  const fullBleed = head === "read" || head === "watch" || head === "gallery";

  let view: React.ReactNode;
  if (!head) view = <HomeView />;
  else if (head === "browse") view = <BrowseView category={a} query={q} />;
  else if (head === "search") view = <SearchView query={q} />;
  else if (head === "media") view = <DetailView provider={provider} id={id} />;
  else if (head === "read") view = <ReaderView provider={provider} id={id} chapterKey={q.get("ch")} />;
  else if (head === "watch") view = <WatchView provider={provider} id={id} episodeKey={q.get("ep")} />;
  else if (head === "gallery") view = <GalleryView provider={provider} id={id} />;
  else if (head === "library") view = <LibraryView />;
  else if (head === "collections") view = <CollectionsView />;
  else if (head === "history") view = <HistoryView />;
  else if (head === "extensions") view = <ExtensionsView />;
  else if (head === "scripts") view = <ScriptsView />;
  else if (head === "databases") view = <DatabasesView />;
  else if (head === "profile") view = <ProfileView />;
  else if (head === "settings") view = <SettingsView />;
  else if (head === "policy") view = <PolicyView />;
  else if (head === "source") view = <SourceView providerId={a} />;
  else if (head === "sources") view = <SourcesView />;
  else if (head === "more") view = <MoreView />;
  else view = <HomeView />;

  return (
    <Shell>
      {fullBleed ? (
        view
      ) : (
        <Suspense fallback={<ViewFallback />}>
          {view}
        </Suspense>
      )}
    </Shell>
  );
}

export default function App() {
  return (
    <AppProviders>
      <Suspense fallback={<ViewFallback />}>
        <Router />
      </Suspense>
    </AppProviders>
  );
}
