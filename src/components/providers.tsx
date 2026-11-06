"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, post } from "@/lib/client-api";
import { AgeGate } from "@/components/age-gate";

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isDemo: boolean;
  ageVerified: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  ageVerified: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AppProviders");
  return ctx;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      })
  );
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ageVerified, setAgeVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: SessionUser | null; ageVerified: boolean }>("/api/auth/me");
      setUser(data.user);
      setAgeVerified(data.ageVerified || !!data.user?.ageVerified || localStorage.getItem("yozora_age") === "1");
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await post<{ user: SessionUser }>("/api/auth/login", { username, password });
    setUser(data.user);
    setAgeVerified(true);
  }, []);

  const register = useCallback(async (username: string, password: string, displayName?: string) => {
    const data = await post<{ user: SessionUser }>("/api/auth/register", { username, password, displayName });
    setUser(data.user);
    setAgeVerified(true);
  }, []);

  const demoLogin = useCallback(async () => {
    const data = await post<{ user: SessionUser }>("/api/auth/demo");
    setUser(data.user);
    setAgeVerified(true);
  }, []);

  const logout = useCallback(async () => {
    await post("/api/auth/logout");
    setUser(null);
  }, []);

  const acceptAge = useCallback(async () => {
    localStorage.setItem("yozora_age", "1");
    try {
      await post("/api/age");
    } catch {
      // cookie set is best-effort
    }
    setAgeVerified(true);
  }, []);

  const value = useMemo(
    () => ({ user, ageVerified, loading, refresh, login, register, demoLogin, logout }),
    [user, ageVerified, loading, refresh, login, register, demoLogin, logout]
  );

  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={value}>
        <AgeGate open={!loading && !ageVerified} onAccept={acceptAge} />
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
