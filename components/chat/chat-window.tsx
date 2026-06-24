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
  onSendMessage: (message: string, files?: File[]) => void;
  onSuggestionClick: (suggestion: string) => void;
}

export function ChatWindow({
  messages,
  isLoading,
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
    <div className="flex flex-col h-full bg-background">
      {/* Messages Thread Container */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
      >
        <div className="max-w-4xl mx-auto space-y-2">
          {messages.length === 0 && !isLoading ? (
            <EmptyState onSuggestionClick={onSuggestionClick} />
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
              </AnimatePresence>

              {/* Loading indicator — rendered as assistant bubble */}
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="max-w-2xl px-4 py-3 bg-[var(--surface-2)] border border-border rounded-3xl rounded-bl-sm shadow-[0_1px_3px_0_var(--border)]">
                      <LoadingIndicator />
                    </div>
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
