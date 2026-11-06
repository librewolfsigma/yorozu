"use client";

import { useEffect, useState, useCallback } from "react";

export interface HashRoute {
  path: string;
  segments: string[];
  query: URLSearchParams;
  raw: string;
}

function parse(hash: string): HashRoute {
  const raw = hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { path, segments, query: new URLSearchParams(qs ?? ""), raw };
}

export function useHashRoute() {
  const [route, setRoute] = useState<HashRoute>(() =>
    typeof window === "undefined" ? { path: "/", segments: [], query: new URLSearchParams(), raw: "/" } : parse(window.location.hash)
  );

  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((to: string) => {
    if (window.location.hash === `#${to}`) return;
    window.location.hash = to;
  }, []);

  return { route, navigate };
}

export function navigate(to: string) {
  window.location.hash = to;
}
