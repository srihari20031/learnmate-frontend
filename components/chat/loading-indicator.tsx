'use client';

import { motion, useReducedMotion } from 'framer-motion';

export function LoadingIndicator() {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <span className="text-muted-foreground text-sm">…</span>;
  }

  return (
    <div className="flex items-end gap-[3px] h-4" aria-label="Thinking">
      {[0, 100, 200].map((delay) => (
        <motion.span
          key={delay}
          className="w-[2.5px] rounded-full bg-accent"
          style={{ boxShadow: '0 0 6px 0 color-mix(in oklch, var(--accent) 30%, transparent)' }}
          animate={{ height: ['4px', '16px', '4px'] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: delay / 1000,
          }}
        />
      ))}
    </div>
  );
}
