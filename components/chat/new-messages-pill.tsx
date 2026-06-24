'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

interface NewMessagesPillProps {
  visible: boolean;
  onClick: () => void;
  reducedMotion: boolean;
}

export function NewMessagesPill({ visible, onClick, reducedMotion }: NewMessagesPillProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <AnimatePresence>
        {visible && (
          <motion.button
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? {} : { opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium shadow-md"
            onClick={onClick}
            aria-live="polite"
            aria-label="Scroll to new messages"
          >
            <ArrowDown className="w-3 h-3" />
            New messages
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
