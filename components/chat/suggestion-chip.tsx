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
      variant="outline"
      className="h-auto py-3 px-4 text-left font-normal text-base rounded-lg border border-muted-foreground/30 hover:bg-accent hover:border-accent transition-colors"
    >
      {text}
    </Button>
  );
}
