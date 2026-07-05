'use client';

import { useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Copy, RefreshCw, Pencil, FileText, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message, Attachment, formatTimestamp, friendlyFileType } from '@/lib/chat-utils';
import { NotionCard } from './notion-card';

interface ChatMessageProps {
  message: Message;
  index?: number; // used for stagger delay
}

// Pure stagger delay function (extract as named export for tests later)
export const staggerDelay = (index: number): number =>
  Math.min(index, 8) * 0.06;

// Animation variants for entrance/exit
const messageVariants = {
  initial: (reducedMotion: boolean) => ({
    opacity: reducedMotion ? 1 : 0,
    y: reducedMotion ? 0 : 12,
  }),
  animate: { opacity: 1, y: 0 },
  exit: (reducedMotion: boolean) => ({
    opacity: reducedMotion ? 1 : 0,
  }),
};

// Assistant avatar — gradient brand chip with a sparkle glyph
function AssistantAvatar() {
  return (
    <div
      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center shadow-[var(--elev-1)]"
      style={{ background: 'var(--gradient-accent)' }}
      aria-hidden="true"
    >
      {/* Simple sparkle/star icon rendered as SVG */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7 1L8.39 5.26L13 7L8.39 8.74L7 13L5.61 8.74L1 7L5.61 5.26L7 1Z"
          fill="var(--accent-foreground)"
        />
      </svg>
    </div>
  );
}

function ImagePreviewModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close preview"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Preview"
        className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (attachment.type === 'image' && attachment.base64) {
    const src = attachment.base64.startsWith('data:')
      ? attachment.base64
      : `data:${attachment.mime_type || 'image/png'};base64,${attachment.base64}`;

    return (
      <>
        <button
          onClick={() => setIsPreviewOpen(true)}
          className="mt-2 rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity"
        >
          <img
            src={src}
            alt={attachment.filename}
            className="max-w-[200px] max-h-[200px] object-cover"
          />
        </button>
        {isPreviewOpen && (
          <ImagePreviewModal src={src} onClose={() => setIsPreviewOpen(false)} />
        )}
      </>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-border max-w-xs">
      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-foreground truncate">{attachment.filename}</p>
        <p className="text-[10px] text-muted-foreground">
          {friendlyFileType(attachment.filename, attachment.mime_type, attachment.type)}
        </p>
      </div>
    </div>
  );
}

export function ChatMessage({ message, index }: ChatMessageProps) {
  const reducedMotion = useReducedMotion();
  const isUser = message.role === 'user';
  const isChatting = message.status === 'chatting';

  // Prefer backend-provided pages (with titles); fall back to bare URLs.
  const notionPages: { url: string; title?: string }[] = message.notionPages?.length
    ? message.notionPages
    : (message.notionUrls ?? []).map((url) => ({ url }));

  // Cursor blink style — respect reduced motion
  const cursorStyle: React.CSSProperties = reducedMotion
    ? { opacity: 1 }
    : { animation: 'blink 1s step-end infinite' };

  // Action icon row visibility
  const actionRowClass = reducedMotion
    ? 'flex items-center gap-1 mt-1 opacity-[0.6]'
    : 'flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150';

  // Timestamps stay quiet until the message is hovered (cleaner thread).
  const metaVisibility = reducedMotion
    ? 'opacity-60'
    : 'opacity-0 group-hover:opacity-100 transition-opacity duration-150';

  return (
    <motion.div
      custom={reducedMotion}
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={
        reducedMotion
          ? { duration: 0 }
          : { duration: 0.28, ease: [0, 0, 0.2, 1], delay: staggerDelay(index ?? 0) }
      }
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-7`}
    >
      {/* Assistant: bubble-less — avatar + name header, then plain text on the canvas */}
      {!isUser && (
        <div className="w-full max-w-3xl group">
          {/* Header — avatar + name */}
          <div className="flex items-center gap-2 mb-2">
            <AssistantAvatar />
            <span className="text-xs font-semibold tracking-wide text-foreground/70">
              LearnMate
            </span>
          </div>

          {/* Content — aligned under the name (avatar 1.5rem + gap 0.5rem = 2rem) */}
          <div className="pl-8">
            <div className="prose prose-invert max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="mb-3 last:mb-0 text-foreground/90 text-[15px] leading-7">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 mb-3 space-y-1.5 text-foreground/90 text-[15px] leading-7 marker:text-muted-foreground">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-foreground/90 text-[15px] leading-7 marker:text-muted-foreground">
                      {children}
                    </ol>
                  ),
                  code: ({ children }) => (
                    <code className="font-mono text-[13px] bg-surface-2 border border-border/60 rounded px-1.5 py-0.5">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="font-mono bg-surface-1 border border-border/60 rounded-xl p-4 overflow-x-auto mb-3 text-[13px] leading-6">
                      {children}
                    </pre>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold mb-2 mt-1 text-foreground">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-bold mb-2 mt-1 text-foreground">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-[15px] font-bold mb-2 mt-1 text-foreground">{children}</h3>
                  ),
                  a: ({ children, href }) => (
                    <a href={href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 hover:opacity-80">
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-accent/50 pl-3 my-3 text-foreground/75 italic">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
              {/* Streaming cursor */}
              {isChatting && (
                <span
                  className="inline-block text-accent ml-0.5"
                  style={cursorStyle}
                  aria-hidden="true"
                >
                  ▋
                </span>
              )}
            </div>

            {/* Citation chips — retrieved sources backing the answer */}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {message.sources.map((source) => (
                  <span
                    key={source.id}
                    title={source.snippet}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                      source.cited
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    {source.filename}
                  </span>
                ))}
              </div>
            )}

            {/* Post-answer notes generation indicator */}
            {message.generatingNotes && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Generating your notes…
              </div>
            )}

            {/* Stream error state */}
            {message.error && (
              <p className="mt-2 text-xs text-red-400">{message.error}</p>
            )}

            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.attachments.map((attachment, i) => (
                  <AttachmentPreview key={i} attachment={attachment} />
                ))}
              </div>
            )}
            {notionPages.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/40">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {notionPages.length > 1 ? 'Topics saved to Notion' : 'Topic saved to Notion'}
                </p>
                <div className="space-y-2">
                  {notionPages.map((page, index) => (
                    <NotionCard key={`${page.url}-${index}`} url={page.url} title={page.title} />
                  ))}
                </div>
              </div>
            )}

            {/* Footer — timestamp + actions, revealed on hover */}
            <div className="flex items-center gap-1 mt-2 h-5">
              <span className={`text-muted-foreground text-xs mr-1 ${metaVisibility}`}>
                {formatTimestamp(message.timestamp)}
              </span>
              <div className={actionRowClass}>
                <button
                  aria-label="Copy message"
                  className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(message.content).catch(() => {});
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  aria-label="Regenerate response"
                  className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User: bubble only (no avatar), right-aligned */}
      {isUser && (
        <div className="flex flex-col items-end max-w-2xl group">
          {/* Bubble */}
          <div
            className="px-4 py-3 text-accent-foreground rounded-3xl rounded-br-sm shadow-[var(--elev-2)]"
            style={{ background: 'var(--gradient-accent)' }}
          >
            <div className="prose max-w-none text-sm">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 text-accent-foreground text-sm">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-2 space-y-1 text-accent-foreground text-sm">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-2 space-y-1 text-accent-foreground text-sm">
                      {children}
                    </ol>
                  ),
                  code: ({ children }) => (
                    <code className="font-mono text-xs bg-black/20 rounded px-1.5 py-0.5">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="font-mono bg-black/20 rounded p-3 overflow-x-auto mb-2 text-sm">
                      {children}
                    </pre>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold mb-2 text-accent-foreground">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-bold mb-2 text-accent-foreground">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-bold mb-2 text-accent-foreground">{children}</h3>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment, i) => (
                    <AttachmentPreview key={i} attachment={attachment} />
                  ))}
                </div>
              )}
            </div>
            {notionPages.length > 0 && (
              <div className="mt-3 pt-3 border-t border-current/20 space-y-2">
                {notionPages.map((page, index) => (
                  <NotionCard key={`${page.url}-${index}`} url={page.url} title={page.title} />
                ))}
              </div>
            )}
          </div>
          {/* Timestamp — revealed on hover */}
          <span className={`text-muted-foreground text-xs mt-1 mr-1 ${metaVisibility}`}>
            {formatTimestamp(message.timestamp)}
          </span>
          {/* Action icons: edit */}
          <div className={actionRowClass}>
            <button
              aria-label="Edit message"
              className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
