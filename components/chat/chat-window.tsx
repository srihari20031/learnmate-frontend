'use client';

import { useRef, useEffect, useState } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { Message } from '@/lib/chat-utils';
import { useScrollAnchor } from '@/hooks/use-scroll-anchor';
import { ChatMessage } from './chat-message';
import { EmptyState } from './empty-state';
import { InputBar } from './input-bar';
import { LoadingIndicator } from './loading-indicator';
import { NewMessagesPill } from './new-messages-pill';

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  /** True while a session's history is being fetched (chat switch / first load). */
  isLoadingHistory?: boolean;
  onSendMessage: (message: string, files?: File[]) => void;
  onSuggestionClick: (suggestion: string) => void;
}

export function ChatWindow({
  messages,
  isLoading,
  isLoadingHistory = false,
  onSendMessage,
  onSuggestionClick,
}: ChatWindowProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const { messagesEndRef, containerRef, isScrolledUp, scrollToBottom } = useScrollAnchor();

  // Track whether new messages have arrived while scrolled up
  const prevMessagesLengthRef = useRef(messages.length);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      if (isScrolledUp) {
        setHasNewMessages(true);
      } else {
        // Auto-scroll when near bottom
        scrollToBottom();
      }
    } else if (!isScrolledUp) {
      // Clear pill when scrolled back to bottom
      setHasNewMessages(false);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, isScrolledUp, scrollToBottom]);

  // Also auto-scroll for isLoading changes when near bottom
  useEffect(() => {
    if (isLoading && !isScrolledUp) {
      scrollToBottom();
    }
  }, [isLoading, isScrolledUp, scrollToBottom]);

  // Dismiss pill when user scrolls back to bottom
  useEffect(() => {
    if (!isScrolledUp) {
      setHasNewMessages(false);
    }
  }, [isScrolledUp]);

  const showPill = isScrolledUp && hasNewMessages;

  const handlePillClick = () => {
    scrollToBottom();
    setHasNewMessages(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Thread Container */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
      >
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && isLoadingHistory ? (
            <div className="flex h-[60vh] items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
            </div>
          ) : messages.length === 0 && !isLoading ? (
            <EmptyState onSuggestionClick={onSuggestionClick} />
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
              </AnimatePresence>

              {/* Loading indicator — bubble-less, matches assistant turns */}
              {isLoading && (
                <div className="w-full max-w-3xl mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 shadow-[var(--elev-1)]"
                      style={{ background: 'var(--gradient-accent)' }}
                    >
                      <Bot className="w-3.5 h-3.5 text-accent-foreground" />
                    </div>
                    <span className="text-xs font-semibold tracking-wide text-foreground/70">
                      LearnMate
                    </span>
                  </div>
                  <div className="pl-8">
                    <LoadingIndicator />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-px" />
            </>
          )}
        </div>

        {/* New Messages Pill — absolutely positioned within the relative thread container */}
        <NewMessagesPill
          visible={showPill}
          onClick={handlePillClick}
          reducedMotion={reducedMotion}
        />
      </div>

      <InputBar
        onSend={onSendMessage}
        disabled={isLoading}
      />
    </div>
  );
}
