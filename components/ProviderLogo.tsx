"use client";

import { useState } from "react";

/** Generic key glyph — the fallback when a provider has no logo PNG yet. */
function KeyGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

/**
 * Renders /logos/<provider>.png in a fixed box (object-contain, so source
 * dimensions don't matter). Missing/broken file falls back to a key glyph,
 * so adding a provider before its logo never breaks the UI.
 */
export default function ProviderLogo({
  provider,
  box = "h-[18px] w-[18px]",
}: {
  provider: string;
  /** Tailwind size classes for the box (defaults to the card size). */
  box?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <KeyGlyph className={`${box} text-muted`} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static icon needing an onError fallback to a glyph; next/image adds no value here
    <img
      src={`/logos/${provider}.png`}
      alt={provider}
      onError={() => setFailed(true)}
      className={`${box} rounded-[5px] object-contain`}
    />
  );
}
