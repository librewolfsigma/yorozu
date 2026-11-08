"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("@/components/app"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-gradient-to-br from-primary to-[#8B5CF6]" />
        <p className="font-display text-xl text-white">Yozora</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <App />;
}
