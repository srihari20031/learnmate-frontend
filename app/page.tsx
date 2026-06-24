'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChatWindow } from '@/components/chat/chat-window';
import { Sidebar } from '@/components/chat/sidebar';
import { LogOut } from 'lucide-react';
import {
  createMessage,
  truncateTitle,
  Message,
  ChatSession,
  Attachment,
} from '@/lib/chat-utils';
import {
  createChat,
  listChats,
  getMessages,
  sendMessage,
  resetChat,
  logout,
  getCurrentUser,
  updateChatTitle,
  ChatSessionResponse,
  ChatMessageResponse,
  UpdateChatTitleResponse,
} from '@/lib/api';

const toChatSession = (chat: ChatSessionResponse): ChatSession => ({
  id: chat.session_id,
  title: chat.title || 'New Chat',
  createdAt: Date.parse(chat.created_at) || Date.now(),
  messageCount: 0,
});

const toMessage = (message: ChatMessageResponse, index: number): Message => {
  let sentAt = message.sent_at;
  if (sentAt && !sentAt.endsWith('Z') && !sentAt.includes('+')) {
    sentAt = sentAt + 'Z';
  }
  const timestamp = sentAt ? Date.parse(sentAt) || Date.now() + index : Date.now() + index;
  const role = message.role === 'user' ? 'user' : 'agent';

  const attachments: Attachment[] | undefined = message.attachments?.length
    ? message.attachments.map((a) => ({
        filename: a.filename,
        type: a.type,
        mime_type: a.mime_type,
        base64: a.base64,
      }))
    : undefined;

  return {
    id: `${role}-${index}-${timestamp}`,
    role,
    content: message.content,
    timestamp,
    status: role === 'agent' ? 'completed' : undefined,
    notionUrls: message.notion_urls,
    attachments,
  };
};

const toMessages = (messages: ChatMessageResponse[]): Message[] =>
  messages.map((message, index) => toMessage(message, index));

export default function ChatPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [authReady, setAuthReady] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  // Initialize based on isMobile: open on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Ref for the hamburger toggle button — used to restore focus when the mobile sidebar closes
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  // Sync sidebar state when viewport crosses the mobile/desktop breakpoint
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const createBackendChat = useCallback(async () => {
    const chat = await createChat();
    const session = toChatSession(chat);

    setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
    setActiveSessionId(session.id);
    setMessages([]);

    return session;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const profile = await getCurrentUser();
        if (cancelled) return;
        setUserEmail(profile.email);
        setUserName(profile.full_name);
        setAuthReady(true);
      } catch {
        if (!cancelled) {
          router.replace('/login');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    const loadChats = async () => {
      try {
        const data = await listChats();
        if (cancelled) return;

        const loadedSessions = data.chats.map(toChatSession);
        setSessions(loadedSessions);

        if (loadedSessions.length > 0) {
          const latestSession = loadedSessions[0];
          setActiveSessionId(latestSession.id);

          const messagesData = await getMessages(latestSession.id);
          if (cancelled) return;

          const loadedMessages = toMessages(messagesData.messages);
          setMessages(loadedMessages);
          setSessions((prev) =>
            prev.map((session) =>
              session.id === latestSession.id
                ? { ...session, messageCount: loadedMessages.length }
                : session
            )
          );
        } else {
          await createBackendChat();
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Chat]', error);
          await createBackendChat();
        }
      }
    };

    loadChats();

    return () => {
      cancelled = true;
    };
  }, [authReady, createBackendChat]);

  const handleSendMessage = useCallback(
    async (userMessage: string, files?: File[]) => {
      if (!userMessage.trim() || !activeSessionId) return;

      try {
        const userMsg = createMessage(userMessage, 'user', undefined, undefined, undefined);
        setMessages((prev) => [...prev, userMsg]);
        setIsSending(true);

        const data = await sendMessage(activeSessionId, userMessage, files);
        const agentMsg = createMessage(data.response, 'agent', 'completed', data.notion_urls);
        setMessages((prev) => [...prev, agentMsg]);

        setSessions((prev) => {
          const existingSession = prev.find((session) => session.id === activeSessionId);

          if (existingSession && existingSession.messageCount === 0) {
            const newTitle = truncateTitle(userMessage);
            updateChatTitle(activeSessionId, newTitle).catch((error) =>
              console.error('[API] Failed to update title', error)
            );
            return prev.map((session) =>
              session.id === activeSessionId
                ? { ...session, title: newTitle, messageCount: session.messageCount + 2 }
                : session
            );
          }

          if (existingSession) {
            return prev.map((session) =>
              session.id === activeSessionId
                ? { ...session, messageCount: session.messageCount + 2 }
                : session
            );
          }

          return [
            { id: activeSessionId, title: truncateTitle(userMessage), createdAt: Date.now(), messageCount: 2 },
            ...prev,
          ];
        });
      } catch (error) {
        console.error('[API]', error);
      } finally {
        setIsSending(false);
      }
    },
    [activeSessionId]
  );

  const handleNewChat = useCallback(async () => {
    try {
      await createBackendChat();
    } catch (error) {
      console.error('[Chat]', error);
    }
  }, [createBackendChat]);

  const handleSelectSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    setMessages([]);

    try {
      const messagesData = await getMessages(id);
      const loadedMessages = toMessages(messagesData.messages);
      setMessages(loadedMessages);
      setSessions((prev) =>
        prev.map((session) =>
          session.id === id ? { ...session, messageCount: loadedMessages.length } : session
        )
      );
    } catch (error) {
      console.error('[Chat]', error);
      setMessages([]);
    }
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await resetChat(id);
        setSessions((prev) => prev.filter((session) => session.id !== id));

        if (activeSessionId === id) {
          await createBackendChat();
        }
      } catch (error) {
        console.error('[Chat]', error);
      }
    },
    [activeSessionId, createBackendChat]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [router]);

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        isOpen={sidebarOpen}
        isMobile={isMobile}
        toggleButtonRef={toggleButtonRef as React.RefObject<HTMLElement>}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header bar — always visible, houses the sidebar toggle */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-[var(--surface-1)] flex-shrink-0">
          {/* Sidebar toggle — hamburger when closed, panel icon when open */}
          <button
            ref={toggleButtonRef}
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-2 rounded-lg text-foreground hover:bg-[var(--surface-2)] transition-colors"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={sidebarOpen}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
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
              aria-label="Sign out"
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
