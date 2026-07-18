"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "glass:show-private";

/**
 * Whether private-store cards are visible. Default HIDDEN — even past the
 * password gate, private cards only show after an explicit toggle. The choice
 * persists per browser via localStorage.
 */
const PrivateVisibilityContext = createContext<{
  showPrivate: boolean;
  toggle: () => void;
}>({ showPrivate: false, toggle: () => {} });

export function PrivateVisibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Starts false on both server and client so hydration always matches;
  // the stored preference applies right after mount.
  const [showPrivate, setShowPrivate] = useState(false);

  useEffect(() => {
    try {
      // Intentional one-shot hydration of state from an external system
      // (localStorage) after mount — same pattern as LockProvider.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setShowPrivate(true);
    } catch {
      // localStorage unavailable (private mode) — stay hidden.
    }
  }, []);

  const toggle = () =>
    setShowPrivate((v) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });

  return (
    <PrivateVisibilityContext.Provider value={{ showPrivate, toggle }}>
      {children}
    </PrivateVisibilityContext.Provider>
  );
}

export function usePrivateVisibility() {
  return useContext(PrivateVisibilityContext);
}
