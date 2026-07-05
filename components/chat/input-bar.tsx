'use client';

import { useRef, useState, useEffect, ChangeEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, Paperclip, X } from 'lucide-react';

interface InputBarProps {
  onSend: (message: string, files?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/bmp',
  'image/webp',
];

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="text-sm mb-2 px-1" style={{ color: 'var(--destructive)' }} role="alert">
      {message}
    </p>
  );
}

function AttachmentChip({ file, onDismiss }: { file: File; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 mb-2 rounded-lg bg-[var(--surface-2)] border border-border text-sm text-foreground w-fit max-w-full">
      <span className="truncate max-w-[220px] text-xs">{file.name}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss attachment"
        className="flex-shrink-0 rounded p-0.5 hover:bg-[var(--surface-1)] transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function InputBar({
  onSend,
  disabled = false,
  placeholder = 'Message LearnMate...',
}: InputBarProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion() ?? false;

  // Auto-resize textarea — grows upward, max ~160 px (~6 lines)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [message]);

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    onSend(message, attachedFiles.length > 0 ? attachedFiles : undefined);
    setMessage('');
    setAttachedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setFileError(null);

    const invalid = files.some(
      (f) => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_SIZE
    );
    if (invalid) {
      const bad = files.find((f) => !ALLOWED_TYPES.includes(f.type));
      if (bad) setFileError('Unsupported file type. Allowed: PDF, DOCX, DOC, TXT, and images.');
      else setFileError('One or more files exceed 20 MB limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setAttachedFiles((prev) => [...prev, ...files]);
  };

  const dismissAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isSendDisabled = !message.trim() || disabled;

  return (
    <div className="px-4 pb-5 pt-2">
      <div className="max-w-3xl mx-auto">
        {fileError && <ErrorMessage message={fileError} />}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachedFiles.map((file, index) => (
              <AttachmentChip key={file.name + index} file={file} onDismiss={() => dismissAttachment(index)} />
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,image/*"
          onChange={handleFileSelect}
          className="hidden"
          multiple
          data-testid="composer-file-input"
        />

        {/* Composer shell — rounded pill that grows with content */}
        <div
          className="glass relative flex flex-col rounded-2xl border transition-all duration-200"
          style={{
            borderColor: isFocused
              ? 'color-mix(in oklch, var(--accent) 55%, var(--border))'
              : 'var(--border)',
            boxShadow: isFocused ? 'var(--glow-accent)' : 'var(--elev-2)',
          }}
        >


          {/* Textarea — full width, no border, transparent bg */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm leading-relaxed px-4 pt-3.5 pb-1"
            style={{ minHeight: '44px', maxHeight: '160px' }}
          />

          {/* Bottom toolbar — attach left, send right */}
          <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1">
            {/* Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              aria-label="Attach file"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Send button */}
            <motion.button
              type="button"
              onClick={handleSend}
              aria-label="Send message"
              whileTap={isSendDisabled ? undefined : { scale: 0.88 }}
              transition={{ duration: reducedMotion ? 0 : 0.12, ease: 'easeOut' }}
              className={[
                'h-8 w-8 rounded-full flex items-center justify-center transition-all duration-150',
                isSendDisabled
                  ? 'bg-surface-2 text-muted-foreground opacity-40 cursor-not-allowed pointer-events-none'
                  : 'text-accent-foreground hover:opacity-90 shadow-[var(--elev-2)]',
              ].join(' ')}
              style={isSendDisabled ? undefined : { background: 'var(--gradient-accent)' }}
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            </motion.button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-center text-xs text-muted-foreground mt-2 opacity-50">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
