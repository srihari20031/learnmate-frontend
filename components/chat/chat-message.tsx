'use client';

import ReactMarkdown from 'react-markdown';
import { Message } from '@/lib/chat-utils';
import { NotionCard } from './notion-card';
import { LoadingIndicator } from './loading-indicator';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

export function ChatMessage({ message, isLoading }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 message-${isUser ? 'user' : 'agent'}`}
    >
      <div
        className={`max-w-2xl rounded-3xl px-4 py-3 transition-all duration-300 ${
          isUser
            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-sm shadow-lg hover:shadow-blue-500/20 hover:shadow-2xl'
            : 'bg-slate-800/50 backdrop-blur border border-slate-700/50 text-foreground rounded-bl-sm hover:bg-slate-800/70 transition-colors'
        }`}
      >
        {isLoading ? (
          <LoadingIndicator />
        ) : (
          <>
            <div className="prose prose-invert max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-sm mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => (
                    <ul className="text-sm list-disc list-inside mb-2 space-y-1">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="text-sm list-decimal list-inside mb-2 space-y-1">
                      {children}
                    </ol>
                  ),
                  code: ({ children }) => (
                    <code className="bg-black/30 rounded px-1.5 py-0.5 font-mono text-xs">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-black/30 rounded p-3 overflow-x-auto mb-2">
                      {children}
                    </pre>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold mb-2">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-bold mb-2">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-bold mb-2">{children}</h3>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
            {message.notionUrls && message.notionUrls.length > 0 && (
              <div className="mt-3 pt-3 border-t border-current/20 space-y-2">
                {message.notionUrls.map((url, index) => (
                  <NotionCard key={`${url}-${index}`} url={url} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
