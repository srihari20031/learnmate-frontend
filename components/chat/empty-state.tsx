'use client';

import { SuggestionChip } from './suggestion-chip';

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  const suggestions = [
    'I want to learn FastAPI',
    'Teach me Docker',
    'Help me learn Redis',
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="max-w-md">
        <h1 className="text-4xl font-bold text-foreground mb-2">LearnMate</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Learn any technology through conversation. I&apos;ll create structured notes in Notion for you.
        </p>
        <div className="flex flex-col gap-3">
          {suggestions.map((suggestion) => (
            <SuggestionChip
              key={suggestion}
              text={suggestion}
              onClick={() => onSuggestionClick(suggestion)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
