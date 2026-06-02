'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChatWindow } from '@/components/chat/chat-window';
import { Sidebar } from '@/components/chat/sidebar';
import { LogOut } from 'lucide-react';
import {
  generateSessionId,
  createMessage,
  truncateTitle,
  Message,
  ChatSession,
} from '@/lib/chat-utils';
import { logout, authHeaders, getCurrentUser } from '@/lib/api';

export default function ChatPage() {
  const router = useRouter();

  // ── Auth state ───────────────────────────────────────────────────────────
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [authReady, setAuthReady] = useState(false);

  // ── Chat state ───────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string>(() => generateSessionId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(sessionId);
  const [sidebarOpen, setSidebarOpen] = useState(true);

// ── Load current user on mount ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const profile = await getCurrentUser();
        setUserId(profile.id);
        setUserEmail(profile.email);
        setUserName(profile.full_name);
        setAuthReady(true);
      } catch {
        router.replace('/login');
      }
    })();
  }, [router]);

  // ── Still loading profile ────────────────────────────────────────────────
  const isLoading = !authReady;

  // ── Send message to FastAPI ──────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || !activeSessionId) return;

      try {
        const userMsg = createMessage(userMessage, 'user');
        setMessages((prev) => [...prev, userMsg]);
        setIsSending(true);

        const authHeader = authHeaders();

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learn/message`, {
          method: 'POST',
          headers: {
            ...authHeader,
            'Content-Type': 'application/json',
            'session-id': activeSessionId,
          },
          body: JSON.stringify({ message: userMessage }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Backend error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const agentMsg = createMessage(data.response, 'agent', data.status, data.notion_urls);
        setMessages((prev) => [...prev, agentMsg]);

        if (!sessions.find((s) => s.id === activeSessionId)) {
          setSessions((prev) => [
            { id: activeSessionId, title: truncateTitle(userMessage), createdAt: Date.now(), messageCount: 2 },
            ...prev,
          ]);
        } else {
          setSessions((prev) =>
            prev.map((s) => (s.id === activeSessionId ? { ...s, messageCount: s.messageCount + 2 } : s))
          );
        }
      } catch (error) {
        console.error('[API]', error);
      } finally {
        setIsSending(false);
      }
    },
    [activeSessionId, sessions]
  );

  const handleNewChat = useCallback(() => {
    setSessionId(generateSessionId());
    setActiveSessionId(generateSessionId());
    setMessages([]);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setMessages([]);
  }, []);

  const handleDeleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) handleNewChat();
    },
    [activeSessionId, handleNewChat]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [router]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {sidebarOpen && (
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onToggle={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1 text-white/70">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Inbox
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {(userName || userEmail).charAt(0).toUpperCase()}
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500">{userEmail}</p>
                {userName && <p className="text-sm text-slate-300">{userName}</p>}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ChatWindow
          messages={messages}
          isLoading={isSending}
          onSendMessage={handleSendMessage}
          onSuggestionClick={handleSendMessage}
        />
      </div>
    </div>
  );
}
