'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PanelLeftClose, Trash2, SquarePen } from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { NotionSettings } from './notion-settings';
import { ChatSession } from '@/lib/chat-utils';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onToggle: () => void;
  isOpen: boolean;
  isMobile: boolean;
  /** Ref to the hamburger toggle button; focus is restored here when the sidebar closes on mobile. */
  toggleButtonRef?: React.RefObject<HTMLElement>;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onToggle,
  isOpen,
  isMobile,
  toggleButtonRef,
}: SidebarProps) {
  const reducedMotion = useReducedMotion();
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Focus trap ref for mobile overlay — cast is safe because motion.aside renders an <aside>
  const focusTrapRef = useFocusTrap({
    enabled: isMobile && isOpen,
    onEscape: onToggle,
    returnFocusRef: toggleButtonRef,
  }) as React.RefObject<HTMLElement>;

  const dur = (normal: number) => (reducedMotion ? 0 : normal);

  // ── Arrow-key navigation for the session listbox ──────────────────────────
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (sessions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => (prev < sessions.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : sessions.length - 1));
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(sessions.length - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < sessions.length) {
            onSelectSession(sessions[focusedIndex].id);
          }
          break;
        default:
          break;
      }
    },
    [sessions, focusedIndex, onSelectSession]
  );

  // ── Shared sidebar content ────────────────────────────────────────────────
  const sidebarContent = (
    <>
      {/* Header — toggle + new chat, like Claude/ChatGPT */}
      <div className="px-3 py-3 flex items-center justify-between flex-shrink-0">
        <button
          onClick={onToggle}
          aria-label="Close sidebar"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)] transition-colors duration-150"
        >
          <PanelLeftClose className="w-5 h-5" aria-hidden="true" />
        </button>
        <button
          onClick={onNewChat}
          aria-label="New Chat"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)] transition-colors duration-150"
        >
          <SquarePen className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Session list — role="listbox" with arrow-key navigation */}
      <div
        role="listbox"
        aria-label="Chat sessions"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        onBlur={() => setFocusedIndex(-1)}
        className="flex-1 overflow-y-auto py-2 focus-visible:outline-none"
      >
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            No conversations yet
          </p>
        ) : (
          sessions.map((session, index) => {
            const isActive = session.id === activeSessionId;
            const isFocused = index === focusedIndex;

            return (
              <div
                key={session.id}
                role="option"
                aria-selected={isActive}
                tabIndex={-1}
                onClick={() => onSelectSession(session.id)}
                className={`group relative flex items-center justify-between mx-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors duration-100 ${
                  isActive
                    ? 'bg-[var(--surface-2)] text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-[var(--surface-1)] hover:text-foreground'
                } ${isFocused && !isActive ? 'ring-2 ring-[var(--ring)] ring-offset-1 ring-offset-[var(--background)]' : ''}`}
              >
                {/* Active indicator — left-edge bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent rounded-r"
                    aria-hidden="true"
                  />
                )}

                <span className="truncate flex-1 leading-snug">
                  {session.title}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  aria-label={`Delete ${session.title}`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0 ml-1 p-1 rounded hover:text-red-400 text-muted-foreground"
                  tabIndex={-1}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Notion Integration */}
      <div className="px-3 pb-3 flex-shrink-0">
        <NotionSettings />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <div className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
          <span>LearnMate v1.0</span>
        </div>
      </div>
    </>
  );

  // ── Desktop: inline width animation ──────────────────────────────────────
  if (!isMobile) {
    return (
      <motion.aside
        ref={focusTrapRef as React.RefObject<HTMLElement>}
        animate={{ width: isOpen ? 260 : 0 }}
        transition={{
          duration: isOpen ? dur(0.24) : dur(0.20),
          ease: 'easeInOut',
        }}
        className="flex-shrink-0 overflow-hidden bg-[var(--surface-1)] border-r border-border flex flex-col h-full"
        style={{ minWidth: 0 }}
      >
        {/* Inner wrapper keeps content at fixed width so it doesn't squish during animation */}
        <div className="w-[260px] flex flex-col h-full">
          {sidebarContent}
        </div>
      </motion.aside>
    );
  }

  // ── Mobile: fixed overlay with backdrop ──────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur(0.24), ease: 'easeInOut' }}
            className="fixed inset-0 z-40 bg-black"
            aria-hidden="true"
            onClick={onToggle}
          />

          {/* Sidebar panel */}
          <motion.aside
            key="sidebar-panel"
            ref={focusTrapRef as React.RefObject<HTMLElement>}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: dur(0.24), ease: 'easeInOut' }}
            className="fixed left-0 top-0 z-50 flex flex-col bg-[var(--surface-1)] border-r border-border"
            style={{ width: 260, height: '100vh' }}
            aria-modal="true"
            role="dialog"
            aria-label="Navigation sidebar"
          >
            {sidebarContent}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
