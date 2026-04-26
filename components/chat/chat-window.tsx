'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/lib/chat-utils';
import { ChatMessage } from './chat-message';
import { EmptyState } from './empty-state';
import { InputBar } from './input-bar';

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onSuggestionClick: (suggestion: string) => void;
}

export function ChatWindow({
  messages,
  isLoading,
  onSendMessage,
  onSuggestionClick,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <EmptyState onSuggestionClick={onSuggestionClick} />
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <ChatMessage
                  message={{
                    id: 'loading',
                    role: 'agent',
                    content: '',
                    timestamp: Date.now(),
                  }}
                  isLoading={true}
                />
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input Bar */}
      <InputBar
        onSend={onSendMessage}
        disabled={isLoading}
      />
    </div>
  );
}
