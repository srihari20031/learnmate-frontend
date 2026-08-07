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
  /** True from send until the first token — drives the "Thinking…" indicator. */
  isLoading: boolean;
  /** True for the whole turn (send → done) — keeps the input disabled. */
  inputDisabled?: boolean;
  /** True while a session's history is being fetched (chat switch / first load). */
  isLoadingHistory?: boolean;
  onSendMessage: (message: string, files?: File[]) => void;
  onSuggestionClick: (suggestion: string) => void;
  /** Retry a failed async note-generation job for a given assistant message. */
  onRetryNotes?: (messageId: string) => void;
}

export function ChatWindow({
  messages,
  isLoading,
  inputDisabled = false,
  isLoadingHistory = false,
  onSendMessage,
  onSuggestionClick,
  onRetryNotes,
}: ChatWindowProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const { messagesEndRef, containerRef, isScrolledUp, scrollToBottom } = useScrollAnchor();

  // Track whether new messages have arrived while scrolled up
  const prevMessagesLengthRef = useRef(messages.length);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // The streaming typewriter grows the *content* of the last assistant message
  // without adding a new one, so the message-count effect below never sees it.
  // Track the last assistant message's length to follow the text as it types.
  const lastMessage = messages[messages.length - 1];
  const followContentLen =
    lastMessage?.role === 'agent' ? lastMessage.content.length : -1;

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

  // Follow the streaming text: as the typewriter grows the assistant message,
  // keep the viewport pinned to the bottom — unless the user has scrolled up to
  // read earlier content. Uses 'auto' (instant) so each frame sticks cleanly
  // instead of queuing laggy smooth-scroll animations.
  useEffect(() => {
    if (followContentLen < 0) return; // last turn isn't an assistant message
    if (!isScrolledUp) {
      scrollToBottom('auto');
    }
  }, [followContentLen, isScrolledUp, scrollToBottom]);

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
    // flex-1 + min-h-0 so this fills the space left by the header (not 100% of
    // the column, which would overflow and clip the input bar at the bottom).
    <div className="flex flex-col flex-1 min-h-0">
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
                  <ChatMessage key={msg.id} message={msg} onRetryNotes={onRetryNotes} />
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
                  <div className="flex items-center gap-2 pl-8">
                    <LoadingIndicator />
                    <span className="text-xs text-muted-foreground">Thinking…</span>
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
        disabled={inputDisabled}
      />
    </div>
  );
}
