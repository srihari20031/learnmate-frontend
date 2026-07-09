'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SuggestionChip } from './suggestion-chip';
import { getProfile } from '@/lib/api';

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

const DEFAULT_SUGGESTIONS = [
  'I want to learn FastAPI',
  'Teach me Docker',
  'Help me learn Redis',
];

// Turn a single known technology into a learning quick-action. Rotating the
// phrasing by index keeps a stack of chips from reading like a robotic list.
const STACK_PROMPTS: ((tech: string) => string)[] = [
  (tech) => `Go deeper on ${tech}`,
  (tech) => `Advanced ${tech} patterns`,
  (tech) => `Build a project with ${tech}`,
  (tech) => `Best practices in ${tech}`,
];

/** Split the comma-separated known_stack into trimmed, non-empty technologies. */
function parseStack(knownStack: string): string[] {
  return knownStack
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  // Personalized quick actions built from the user's extracted résumé stack.
  // Falls back to the generic suggestions until (or unless) a stack loads.
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const profile = await getProfile();
        if (cancelled || !profile.known_stack) return;

        const techs = parseStack(profile.known_stack).slice(0, 4);
        if (techs.length === 0) return;

        setSuggestions(techs.map((tech, i) => STACK_PROMPTS[i % STACK_PROMPTS.length](tech)));
        setPersonalized(true);
      } catch {
        // No profile / not authenticated yet — keep the default suggestions.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
          {personalized && (
            <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Based on your stack
            </div>
          )}
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
