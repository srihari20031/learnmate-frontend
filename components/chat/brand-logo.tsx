'use client';

import { useId } from 'react';

/**
 * The LearnMate mark: a rounded speech bubble carrying a four-point amber spark,
 * on a teal gradient. A single self-contained SVG (same artwork as the favicon),
 * so it stays sharp at any size. Pass sizing via `className` (e.g. "h-7 w-7").
 */
export function BrandLogo({ className }: { className?: string }) {
  // Unique gradient id per instance so multiple logos on one page don't collide.
  const gid = `lm-mark-${useId()}`;

  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="LearnMate logo"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#31B0C0" />
          <stop offset="1" stopColor="#0E3B48" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill={`url(#${gid})`} />
      <rect x="118" y="128" width="276" height="214" rx="58" fill="#F7F3EC" />
      <path d="M182 322 L182 404 L252 330 Z" fill="#F7F3EC" />
      <path
        d="M256 178 q10 52 64 57 q-54 5 -64 57 q-10 -52 -64 -57 q54 -5 64 -57 z"
        fill="#E0951F"
      />
    </svg>
  );
}
