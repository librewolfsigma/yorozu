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

// Distinguishes push-navigations (app-driven → scroll to top) from browser
// back/forward (pop → restore the saved scroll position for that hash).
let programmaticNav = false;

// Scroll journal: hash → last scrollY, in sessionStorage (per tab, bounded by
// session lifetime). Saved continuously (throttled) so back/forward can restore.
const scrollKey = (hash: string) => `yz-scroll:${hash}`;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function onScrollSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    const hash = window.location.hash;
    if (hash && hash !== "#/" && hash !== "") {
      try {
        sessionStorage.setItem(scrollKey(hash), String(window.scrollY));
      } catch {
        /* storage full/unavailable — scroll restoration is best-effort */
      }
    }
  }, 180);
}

export function useHashRoute() {
  const [route, setRoute] = useState<HashRoute>(() =>
    typeof window === "undefined" ? { path: "/", segments: [], query: new URLSearchParams(), raw: "/" } : parse(window.location.hash)
  );

  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash));
      if (programmaticNav) {
        programmaticNav = false;
        window.scrollTo({ top: 0 });
      } else {
        // browser back/forward — restore this hash's saved position if any.
        // Lazy feeds grow after mount, so retry briefly until the document is
        // tall enough (or ~1.2s budget expires).
        const saved = Number(sessionStorage.getItem(scrollKey(window.location.hash)) ?? 0);
        const attempts = [0, 120, 300, 600, 1200];
        for (const delay of attempts) {
          setTimeout(() => {
            if (window.scrollY > 0) return; // a later attempt already landed
            if (saved === 0 || document.documentElement.scrollHeight >= saved + window.innerHeight) {
              window.scrollTo({ top: saved });
            }
          }, delay);
        }
      }
    };
    window.addEventListener("hashchange", onChange);
    window.addEventListener("scroll", onScrollSave, { passive: true });
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("scroll", onScrollSave);
    };
  }, []);

  const navigate = useCallback((to: string) => {
    if (window.location.hash === `#${to}`) return;
    programmaticNav = true;
    window.location.hash = to;
  }, []);

  return { route, navigate };
}

export function navigate(to: string) {
  if (window.location.hash === `#${to}`) return;
  programmaticNav = true;
  window.location.hash = to;
}
