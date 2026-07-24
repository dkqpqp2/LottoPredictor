"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { getProgress, type ProgressResult } from "../../lib/progress";

interface ProgressContextValue {
  progress: ProgressResult | null;
  refreshProgress: () => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const [progress, setProgress] = useState<ProgressResult | null>(null);

  function refreshProgress() {
    if (!auth) {
      setProgress(null);
      return;
    }
    getProgress(auth.token)
      .then(setProgress)
      .catch(() => setProgress(null));
  }

  useEffect(() => {
    refreshProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  return <ProgressContext.Provider value={{ progress, refreshProgress }}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return ctx;
}
