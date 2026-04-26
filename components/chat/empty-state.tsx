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
    <div className="flex flex-col items-center justify-center h-full text-center px-4 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-30 animate-pulse-glow">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>

      <div className="max-w-md relative z-10 animate-fade-in">
        {/* Logo/Title */}
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 animate-float">
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">LM</span>
        </div>

        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-3">
          LearnMate
        </h1>
        <p className="text-base text-gray-400 mb-10 leading-relaxed">
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
