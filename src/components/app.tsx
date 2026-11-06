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
const DownloadsView = lazy(() => import("@/views/downloads"));
const ExtensionsView = lazy(() => import("@/views/extensions"));
const ScriptsView = lazy(() => import("@/views/scripts"));
const DatabasesView = lazy(() => import("@/views/databases"));
const ProfileView = lazy(() => import("@/views/profile"));
const SettingsView = lazy(() => import("@/views/settings"));
const PolicyView = lazy(() => import("@/views/policy"));
const SourceView = lazy(() => import("@/views/source"));

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
  const [head, a, b] = seg;

  // full-bleed views manage their own chrome
  const fullBleed = head === "read" || head === "watch" || head === "gallery";

  let view: React.ReactNode;
  if (!head) view = <HomeView />;
  else if (head === "browse") view = <BrowseView category={a} query={route.query} />;
  else if (head === "search") view = <SearchView query={route.query} />;
  else if (head === "media") view = <DetailView slug={a} />;
  else if (head === "read") view = <ReaderView slug={a} chapterId={b} />;
  else if (head === "watch") view = <WatchView slug={a} episodeId={b} />;
  else if (head === "gallery") view = <GalleryView slug={a} />;
  else if (head === "library") view = <LibraryView />;
  else if (head === "collections") view = <CollectionsView />;
  else if (head === "history") view = <HistoryView />;
  else if (head === "downloads") view = <DownloadsView />;
  else if (head === "extensions") view = <ExtensionsView />;
  else if (head === "scripts") view = <ScriptsView />;
  else if (head === "databases") view = <DatabasesView />;
  else if (head === "profile") view = <ProfileView />;
  else if (head === "settings") view = <SettingsView />;
  else if (head === "policy") view = <PolicyView />;
  else if (head === "source") view = <SourceView providerId={a} />;
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
