'use client';

import { Button } from '@/components/ui/button';

interface SuggestionChipProps {
  text: string;
  onClick: () => void;
}

export function SuggestionChip({ text, onClick }: SuggestionChipProps) {
  return (
    <Button
      onClick={onClick}
      className="h-auto w-full justify-start py-3 px-4 text-left font-normal text-sm rounded-xl border border-border/80 bg-surface-1/70 hover:bg-surface-2 hover:border-border-strong transition-all duration-200 group shadow-[var(--elev-1)] hover:-translate-y-0.5"
    >
      <span className="text-foreground/90 group-hover:text-foreground transition-colors font-medium">{text}</span>
    </Button>
  );
}
