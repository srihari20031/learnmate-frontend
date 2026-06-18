'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChatWindow } from '@/components/chat/chat-window';
import { Sidebar } from '@/components/chat/sidebar';
import { LogOut } from 'lucide-react';
import {
  createMessage,
  truncateTitle,
  Message,
  ChatSession,
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
  uploadFile,
  ChatSessionResponse,
  ChatMessageResponse,
  UpdateChatTitleResponse,
  UploadResponse,
} from '@/lib/api';

const toChatSession = (chat: ChatSessionResponse): ChatSession => ({
  id: chat.session_id,
  title: chat.title || 'New Chat',
  createdAt: Date.parse(chat.created_at) || Date.now(),
  messageCount: 0,
});

const toMessage = (message: ChatMessageResponse, index: number): Message => {
  const timestamp = message.created_at
    ? Date.parse(message.created_at) || Date.now() + index
    : Date.now() + index;
  const role = message.role === 'user' ? 'user' : 'agent';

  return {
    id: `${role}-${index}-${timestamp}`,
    role,
    content: message.content,
    timestamp,
    status: role === 'agent' ? 'completed' : undefined,
    notionUrls: message.notion_urls,
  };
};

const toMessages = (messages: ChatMessageResponse[]): Message[] =>
  messages.map((message, index) => toMessage(message, index));

export default function ChatPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [authReady, setAuthReady] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const createBackendChat = useCallback(async () => {
    const chat = await createChat();
    const session = toChatSession(chat);

    setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
    setActiveSessionId(session.id);
    setMessages([]);

    return session;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const profile = await getCurrentUser();
        setUserEmail(profile.email);
        setUserName(profile.full_name);
        setAuthReady(true);
      } catch {
        router.replace('/login');
      }
    })();
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
    async (userMessage: string) => {
      if (!userMessage.trim() || !activeSessionId) return;

      try {
        const userMsg = createMessage(userMessage, 'user');
        setMessages((prev) => [...prev, userMsg]);
        setIsSending(true);

        const data = await sendMessage(activeSessionId, userMessage);
        const agentMsg = createMessage(data.response, 'agent', data.status, data.notion_urls);
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

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!activeSessionId) return;

      try {
        setIsUploading(true);
        const result = await uploadFile(activeSessionId, file);
        console.log('[Upload]', result.filename, result.type, result.status);
      } catch (error) {
        console.error('[Upload]', error);
      } finally {
        setIsUploading(false);
      }
    },
    [activeSessionId]
  );

  if (!authReady) {
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
          isUploading={isUploading}
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          onSuggestionClick={handleSendMessage}
        />
      </div>
    </div>
  );
}
