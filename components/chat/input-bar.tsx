'use client';

import { useRef, useState, useEffect, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip } from 'lucide-react';

interface InputBarProps {
  onSend: (message: string) => void;
  onUpload?: (file: File) => void;
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

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export function InputBar({
  onSend,
  onUpload,
  disabled = false,
  placeholder = 'Message LearnMate...',
}: InputBarProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Unsupported file type. Allowed: PDF, DOCX, DOC, TXT, and images.');
      return;
    }

    if (file.size > MAX_SIZE) {
      alert('File exceeds 20MB limit.');
      return;
    }

    onUpload?.(file);
    e.target.value = '';
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="px-4 py-4 bg-gradient-to-t from-slate-950 to-slate-900/50 border-t border-slate-700/50 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto flex gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={openFilePicker}
          disabled={disabled}
          className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4 text-slate-400" />
        </button>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed max-h-32 font-normal text-sm transition-all duration-200 hover:border-slate-600/50"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/30 transition-all duration-200"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
