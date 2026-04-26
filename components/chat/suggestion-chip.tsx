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
      className="h-auto py-3 px-4 text-left font-normal text-sm rounded-lg border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all duration-300 group"
    >
      <span className="text-foreground group-hover:text-blue-400 transition-colors">{text}</span>
    </Button>
  );
}
