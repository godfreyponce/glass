"use client";

import { Eye, EyeOff } from "lucide-react";

import { usePrivateVisibility } from "@/components/PrivateVisibilityProvider";

/** Header button that reveals/hides private-store cards. Hidden entirely
 *  when the board has no private cards. */
export default function PrivateToggle({ hasPrivate }: { hasPrivate: boolean }) {
  const { showPrivate, toggle } = usePrivateVisibility();
  if (!hasPrivate) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={showPrivate}
      title={showPrivate ? "Hide private projects" : "Show private projects"}
      className="inline-flex w-fit items-center gap-2 rounded-[6px] border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors duration-200 hover:bg-[#f7f6f3] active:scale-[0.98]"
    >
      {showPrivate ? (
        <EyeOff className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Eye className="h-3.5 w-3.5" aria-hidden />
      )}
      Private
    </button>
  );
}
