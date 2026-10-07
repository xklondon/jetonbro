"use client";

/** Structural curved gold rail — SVG anatomy, not a 2px CSS ellipse. */
export function TableRail({ className }: { className?: string }) {
  return (
    <svg
      className={`tt-rail-svg${className ? ` ${className}` : ""}`}
      viewBox="0 0 390 72"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-table-outer-rail="true"
    >
      <defs>
        <linearGradient id="tt-rail-gold" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(223,189,105,0.15)" />
          <stop offset="18%" stopColor="rgba(223,189,105,0.72)" />
          <stop offset="50%" stopColor="rgba(244,220,150,0.95)" />
          <stop offset="82%" stopColor="rgba(223,189,105,0.72)" />
          <stop offset="100%" stopColor="rgba(223,189,105,0.15)" />
        </linearGradient>
        <linearGradient id="tt-rail-shadow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(3,22,18,0.55)" />
          <stop offset="100%" stopColor="rgba(3,22,18,0)" />
        </linearGradient>
      </defs>
      <path d="M0 72 C 40 18, 120 4, 195 4 S 350 18, 390 72 L 390 0 L 0 0 Z" fill="url(#tt-rail-shadow)" />
      <path
        d="M8 70 C 48 22, 118 10, 195 10 S 342 22, 382 70"
        fill="none"
        stroke="url(#tt-rail-gold)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M18 68 C 54 28, 122 16, 195 16 S 336 28, 372 68"
        fill="none"
        stroke="rgba(244,234,213,0.22)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
