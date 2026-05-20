"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * Holds edit-mode state for the whole dashboard. `passphrase` is null when
 * locked; a string when unlocked. Persisted to sessionStorage so navigating
 * between pages keeps you unlocked, but closing the tab re-locks.
 *
 * Security note: this is a UX gate. The real check is server-side on every
 * PATCH. Storing a passphrase in sessionStorage is fine for single-user
 * Phase 1; replace with a server-set cookie if/when this goes multi-user.
 */

const STORAGE_KEY = "portfolio-dashboard:passphrase";

interface LockContextValue {
  locked: boolean;
  passphrase: string | null;
  unlock: (pass: string) => void;
  lock: () => void;
}

const LockContext = createContext<LockContextValue | null>(null);

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [passphrase, setPassphrase] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      // Intentional one-shot hydration of state from an external system
      // (sessionStorage) after mount — the React docs' approved pattern
      // for syncing client storage to component state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setPassphrase(stored);
    } catch {
      // sessionStorage unavailable (private mode, SSR) — stay locked.
    }
  }, []);

  const unlock = useCallback((pass: string) => {
    setPassphrase(pass);
    try {
      sessionStorage.setItem(STORAGE_KEY, pass);
    } catch {
      /* ignore */
    }
  }, []);

  const lock = useCallback(() => {
    setPassphrase(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <LockContext.Provider
      value={{ locked: passphrase === null, passphrase, unlock, lock }}
    >
      {children}
    </LockContext.Provider>
  );
}

export function useLock(): LockContextValue {
  const ctx = useContext(LockContext);
  if (!ctx) {
    throw new Error("useLock must be used inside a <LockProvider>.");
  }
  return ctx;
}
