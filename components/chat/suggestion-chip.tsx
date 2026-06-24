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
      className="h-auto py-3 px-4 text-left font-normal text-sm rounded-lg border border-border bg-surface-1 hover:bg-surface-2 transition-all duration-300 group shadow-sm"
    >
      <span className="text-foreground group-hover:text-foreground transition-colors font-medium">{text}</span>
    </Button>
  );
}
