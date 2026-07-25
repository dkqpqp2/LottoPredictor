"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe } from "../../lib/auth";

interface AuthState {
  token: string;
  nickname: string;
  isAdmin: boolean;
}

interface AuthContextValue {
  auth: AuthState | null;
  login: (token: string, nickname: string, isAdmin: boolean) => void;
  logout: () => void;
}

const STORAGE_KEY = "lotaro_auth";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed: AuthState = JSON.parse(raw);
      getMe(parsed.token)
        .then((me) => login(parsed.token, me.nickname, me.isAdmin))
        .catch(() => localStorage.removeItem(STORAGE_KEY));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  function login(token: string, nickname: string, isAdmin: boolean) {
    const next = { token, nickname, isAdmin };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuth(next);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }

  return <AuthContext.Provider value={{ auth, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
