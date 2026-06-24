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
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-30 animate-pulse-glow pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>

      <div className="max-w-md relative z-10 animate-fade-in flex flex-col items-center">
        {/* Logo/Title - using subtle bounce instead of float to avoid clipping */}
        <div className="mb-8 inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-2 border border-border hover:shadow-lg hover:shadow-border transition-shadow duration-300">
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">LM</span>
        </div>

        <h1 className="font-display text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-4">
          LearnMate
        </h1>
        <p className="text-base text-muted-foreground mb-12 leading-relaxed max-w-sm">
          Learn any technology through conversation. I&apos;ll create structured notes in Notion for you.
        </p>
        
        <div className="flex flex-col gap-3 w-full max-w-sm">
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
