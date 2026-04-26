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
      className="h-auto py-3 px-4 text-left font-normal text-sm rounded-lg border border-blue-400/40 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-400/60 transition-all duration-300 group shadow-sm"
    >
      <span className="text-slate-200 group-hover:text-blue-200 transition-colors font-medium">{text}</span>
    </Button>
  );
}
