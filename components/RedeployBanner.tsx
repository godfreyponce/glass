"use client";

import { useEffect, useState } from "react";

/**
 * Shown when an edit hit the GitHub-commit path (production). EditableField
 * dispatches the `portfolio:redeploying` event after a successful prod save;
 * we display a small banner for ~90s so the user knows why their change
 * isn't reflected on a hard refresh yet.
 */
export default function RedeployBanner() {
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    let countdown: ReturnType<typeof setInterval> | null = null;

    function start() {
      setVisible(true);
      setRemaining(90);
      if (countdown) clearInterval(countdown);
      countdown = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setVisible(false);
            if (countdown) clearInterval(countdown);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }

    window.addEventListener("portfolio:redeploying", start);
    return () => {
      window.removeEventListener("portfolio:redeploying", start);
      if (countdown) clearInterval(countdown);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-4 z-30 -translate-x-1/2 rounded-[6px] border border-line bg-status-progress-bg px-4 py-2 text-xs text-status-progress-fg shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
    >
      Edit committed. Vercel redeploying — live site updates in ~{remaining}s.
      Don&apos;t hard-refresh.
    </div>
  );
}
