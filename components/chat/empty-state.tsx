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
    <div className="flex flex-col items-center justify-center h-full text-center px-4 relative overflow-visible">
      {/* Soft accent glow background */}
      <div className="absolute inset-0 opacity-60 animate-pulse-glow pointer-events-none">
        <div className="absolute top-24 left-1/4 w-80 h-80 rounded-full filter blur-[100px] opacity-20" style={{ background: 'var(--accent)' }}></div>
        <div className="absolute top-44 right-1/4 w-80 h-80 rounded-full filter blur-[100px] opacity-20" style={{ background: 'var(--accent-2)' }}></div>
      </div>

      <div className="max-w-md relative z-10 animate-fade-in flex flex-col items-center">
        {/* Logo */}
        <div
          className="mb-7 inline-flex items-center justify-center w-16 h-16 rounded-2xl text-accent-foreground text-xl font-bold shadow-[var(--elev-3)] animate-float"
          style={{ background: 'var(--gradient-accent)' }}
        >
          LM
        </div>

        <h1 className="font-display text-5xl mb-4 text-gradient-brand">
          LearnMate
        </h1>
        <p className="text-base text-muted-foreground mb-12 leading-relaxed max-w-sm">
          Learn any technology through conversation. I&apos;ll create structured notes in Notion for you.
        </p>

        <div className="flex flex-col gap-2.5 w-full max-w-sm">
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
