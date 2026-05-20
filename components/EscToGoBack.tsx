"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keyboard listener: pressing Escape navigates back. Falls back to the
 * dashboard if there's no prior history (e.g. a deep-linked detail page).
 */
export default function EscToGoBack() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // If we arrived via in-app navigation, go back; otherwise go home.
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push("/");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
