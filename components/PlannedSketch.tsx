/**
 * Editorial spot illustration for the Planned section's empty state.
 * Monochromatic rough-line ink sketch with one offset pastel shape, per
 * the minimalist-ui guidance. A paper plane is the metaphor: planned
 * work pointed toward the future.
 */
export default function PlannedSketch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 130"
      role="img"
      aria-label="Planned section illustration: a paper plane"
      className={className}
    >
      {/* offset pale-yellow shape (matches the Planned status pastel) */}
      <circle cx="104" cy="46" r="38" fill="#fbf3db" />

      {/* motion lines trailing behind the plane */}
      <g stroke="#787774" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.55">
        <path d="M 14 82 Q 24 79 36 81" />
        <path d="M 8 94 Q 20 91 34 93" />
        <path d="M 22 104 Q 32 102 44 104" />
      </g>

      {/* paper plane — outer silhouette */}
      <path
        d="M 126 22 L 28 58 L 70 78 L 60 110 Z"
        stroke="#2f3437"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* the fold from nose to mid */}
      <path
        d="M 126 22 Q 100 48 70 78"
        stroke="#2f3437"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
