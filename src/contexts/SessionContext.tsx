import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { fetchSession } from '../services/happenedApi';
import { loadSession, saveSession } from '../storage/secureSession';
import type { AuthSession } from '../types/happened';

type SessionContextValue = {
  session: AuthSession | null;
  setSession: (next: AuthSession | null, opts?: { fresh?: boolean }) => void;
  signOut: () => void;
  hydrated: boolean;
  /** True when the current session was just created via auth on this device (post-auth onboarding flow). */
  isFreshSession: boolean;
  consumeFreshSession: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isFreshSession, setIsFreshSession] = useState(false);
  const refreshAttempted = useRef(false);

  const setSession = useCallback((next: AuthSession | null, opts?: { fresh?: boolean }) => {
    setSessionState(next);
    if (next && opts?.fresh) {
      setIsFreshSession(true);
    }
    if (!next) {
      setIsFreshSession(false);
    }
    saveSession(next).catch(() => undefined);
  }, []);

  const signOut = useCallback(() => {
    setSessionState(null);
    setIsFreshSession(false);
    saveSession(null).catch(() => undefined);
  }, []);

  const consumeFreshSession = useCallback(() => setIsFreshSession(false), []);

  useEffect(() => {
    let active = true;
    loadSession()
      .then((cached) => {
        if (!active) return;
        if (cached) {
          setSessionState(cached);
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!active) return;
        setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Refresh session token once after hydration
  useEffect(() => {
    if (!hydrated || !session?.token || refreshAttempted.current) return;
    refreshAttempted.current = true;
    let active = true;
    fetchSession(session.token)
      .then((next) => {
        if (!active) return;
        setSessionState(next);
        saveSession(next).catch(() => undefined);
      })
      .catch(() => {
        if (!active) return;
        setSessionState(null);
        saveSession(null).catch(() => undefined);
      });
    return () => {
      active = false;
    };
  }, [hydrated, session?.token]);

  const value = useMemo(
    () => ({ session, setSession, signOut, hydrated, isFreshSession, consumeFreshSession }),
    [session, setSession, signOut, hydrated, isFreshSession, consumeFreshSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
