'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChatWindow } from '@/components/chat/chat-window';
import { Sidebar } from '@/components/chat/sidebar';
import { LogOut, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  createMessage,
  truncateTitle,
  stripExtractedContent,
  Message,
  ChatSession,
  Attachment,
} from '@/lib/chat-utils';
import {
  createChat,
  listChats,
  getMessages,
  sendMessage,
  sendMessageStream,
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

/**
 * A never-used chat: still carrying the default "New Chat" title and no
 * messages. We reuse one of these instead of creating a fresh chat on every
 * load (a real conversation always gets titled from its first message).
 */
const isEmptyChat = (session: ChatSession): boolean =>
  session.messageCount === 0 && (!session.title || session.title === 'New Chat');

const toMessage = (message: ChatMessageResponse, index: number): Message => {
  let sentAt = message.sent_at;
  if (sentAt && !sentAt.endsWith('Z') && !sentAt.includes('+')) {
    sentAt = sentAt + 'Z';
  }
  const timestamp = sentAt ? Date.parse(sentAt) || Date.now() + index : Date.now() + index;
  const role = message.role === 'user' ? 'user' : 'agent';

  // User messages come back with the extracted document text appended for LLM
  // context — strip it so the bubble only shows what the user typed.
  const content = role === 'user' ? stripExtractedContent(message.content) : message.content;

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
    content,
    timestamp,
    status: role === 'agent' ? 'completed' : undefined,
    notionUrls: message.notion_urls,
    notionPages: message.notion_pages,
    sources: message.sources,
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
  // True while a session's history is being fetched — prevents the empty
  // state from flashing during the async gap when switching chats.
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
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

        // Land on the most recent chat (top of the list). Only create a chat
        // when the user has none — reloads must not pile up empty "New Chat"s.
        if (loadedSessions.length === 0) {
          await createBackendChat();
          return;
        }

        const target = loadedSessions[0];
        setActiveSessionId(target.id);

        // A failure loading this chat's history must NOT create a new chat —
        // just show it empty (an unused chat legitimately has no messages).
        try {
          const messagesData = await getMessages(target.id);
          if (cancelled) return;

          const loadedMessages = toMessages(messagesData.messages);
          setMessages(loadedMessages);
          setSessions((prev) =>
            prev.map((session) =>
              session.id === target.id
                ? { ...session, messageCount: loadedMessages.length }
                : session
            )
          );
        } catch (err) {
          if (!cancelled) {
            console.error('[Chat] Failed to load messages', err);
            setMessages([]);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Chat] Failed to load chats', error);
          await createBackendChat();
        }
      } finally {
        if (!cancelled) setIsLoadingMessages(false);
      }
    };

    loadChats();

    return () => {
      cancelled = true;
    };
  }, [authReady, createBackendChat]);

  // Bump the session's message count (and title, on the first turn) once a
  // reply has landed. Shared by the streaming and fallback paths.
  const finalizeSession = useCallback(
    (sessionId: string, userMessage: string) => {
      setSessions((prev) => {
        const existingSession = prev.find((session) => session.id === sessionId);

        if (existingSession && existingSession.messageCount === 0) {
          const newTitle = truncateTitle(userMessage);
          updateChatTitle(sessionId, newTitle).catch((error) =>
            console.error('[API] Failed to update title', error)
          );
          return prev.map((session) =>
            session.id === sessionId
              ? { ...session, title: newTitle, messageCount: session.messageCount + 2 }
              : session
          );
        }

        if (existingSession) {
          return prev.map((session) =>
            session.id === sessionId
              ? { ...session, messageCount: session.messageCount + 2 }
              : session
          );
        }

        return [
          { id: sessionId, title: truncateTitle(userMessage), createdAt: Date.now(), messageCount: 2 },
          ...prev,
        ];
      });
    },
    []
  );

  const handleSendMessage = useCallback(
    async (userMessage: string, files?: File[]) => {
      if (!userMessage.trim() || !activeSessionId) return;
      const sessionId = activeSessionId;

      const userMsg = createMessage(userMessage, 'user', undefined, undefined, undefined);
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);

      // The assistant bubble is created lazily on the first stream frame so the
      // "typing" loader shows until content actually starts arriving.
      let agentId: string | null = null;

      // ── Typewriter reveal ────────────────────────────────────────────────
      // The backend may deliver the answer in a few large chunks — or entirely
      // inside the final `done` frame — which makes the reply pop in instead of
      // type out. We decouple what's *received* (targetText) from what's *shown*
      // and reveal the gap a little each animation frame, so it always reads as
      // typing regardless of how coarsely the server chunks the response.
      let targetText = '';        // full text received so far
      let shown = 0;              // characters currently revealed
      let streamEnded = false;    // no more chunks will arrive
      let raf: number | null = null;
      let finalPatch: Partial<Message> | null = null; // applied once fully shown

      const ensureAgent = () => {
        if (agentId) return;
        const agentMsg = createMessage('', 'agent', 'chatting');
        agentId = agentMsg.id;
        setMessages((prev) => [...prev, agentMsg]);
        setIsSending(false);
      };

      const patchAgent = (patch: Partial<Message>) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === agentId ? { ...m, ...patch } : m))
        );
      };

      const reveal = () => {
        if (shown < targetText.length) {
          // Ease-out: cover a fraction of the remaining gap each frame (with a
          // floor), so big chunks catch up quickly but the tail still types.
          const remaining = targetText.length - shown;
          shown = Math.min(targetText.length, shown + Math.max(2, Math.ceil(remaining / 22)));
          patchAgent({ content: targetText.slice(0, shown), status: 'chatting' });
          raf = requestAnimationFrame(reveal);
        } else if (!streamEnded) {
          // Caught up, but more chunks may still arrive — keep the loop alive.
          raf = requestAnimationFrame(reveal);
        } else {
          // Fully revealed and the stream is closed — commit the final state.
          raf = null;
          if (finalPatch) {
            patchAgent(finalPatch);
            finalPatch = null;
          }
        }
      };

      const startReveal = () => {
        if (raf === null) raf = requestAnimationFrame(reveal);
      };

      try {
        await sendMessageStream(sessionId, userMessage, files, {
          onSources: (sources) => {
            ensureAgent();
            patchAgent({ sources });
          },
          onDelta: (fullText) => {
            ensureAgent();
            targetText = fullText;
            startReveal();
          },
          onStatus: () => {
            ensureAgent();
            patchAgent({ generatingNotes: true });
          },
          onDone: (evt) => {
            ensureAgent();
            targetText = evt.response || targetText;
            streamEnded = true;
            finalPatch = {
              content: targetText,
              status: 'completed',
              notionUrls: evt.notion_urls,
              notionPages: evt.notion_pages,
              sources: evt.sources ?? undefined,
              generatingNotes: false,
            };
            finalizeSession(sessionId, userMessage);
            startReveal(); // finish revealing, then apply finalPatch
          },
          onError: (message) => {
            ensureAgent();
            streamEnded = true;
            finalPatch = { status: 'completed', generatingNotes: false, error: message };
            startReveal();
          },
        });
      } catch (streamError) {
        // Streaming endpoint unreachable (e.g. 404 / network) and nothing was
        // rendered yet — fall back to the non-streaming message endpoint.
        if (!agentId) {
          try {
            const data = await sendMessage(sessionId, userMessage, files);
            ensureAgent();
            targetText = data.response;
            streamEnded = true;
            finalPatch = {
              content: targetText,
              status: 'completed',
              notionUrls: data.notion_urls,
            };
            finalizeSession(sessionId, userMessage);
            startReveal(); // type the fallback response out too
          } catch (fallbackError) {
            console.error('[API] Fallback send failed', fallbackError);
            ensureAgent();
            patchAgent({ status: 'completed', error: 'Failed to send message. Please try again.' });
          }
        } else {
          console.error('[API] Stream interrupted', streamError);
          streamEnded = true;
          finalPatch = { status: 'completed', generatingNotes: false, error: 'The response was interrupted.' };
          startReveal();
        }
      } finally {
        setIsSending(false);
      }
    },
    [activeSessionId, finalizeSession]
  );

  const handleNewChat = useCallback(async () => {
    // If an empty chat already exists, switch to it rather than creating a
    // duplicate (matches how Claude reuses the pending "new chat").
    const existingEmpty = sessions.find(isEmptyChat);
    if (existingEmpty) {
      setActiveSessionId(existingEmpty.id);
      setMessages([]);
      return;
    }
    try {
      await createBackendChat();
    } catch (error) {
      console.error('[Chat]', error);
    }
  }, [sessions, createBackendChat]);

  const handleSelectSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    setMessages([]);
    setIsLoadingMessages(true);

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
    } finally {
      setIsLoadingMessages(false);
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background:
          'radial-gradient(85% 55% at 50% -8%, rgba(245, 194, 0, 0.10) 0%, transparent 60%), ' +
          'radial-gradient(70% 55% at 100% 105%, rgba(245, 158, 11, 0.08) 0%, transparent 60%), ' +
          'radial-gradient(60% 45% at 20% 110%, rgba(245, 194, 0, 0.05) 0%, transparent 60%), ' +
          'var(--background)',
      }}
    >
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
        <div className="glass flex items-center justify-between px-3 py-2.5 border-b border-border/70 flex-shrink-0 z-10">
          {/* Sidebar toggle — hamburger when closed, panel icon when open */}
          <button
            ref={toggleButtonRef}
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={sidebarOpen}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Account menu — avatar + name open a dropdown with a clear Sign out */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-surface-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Account menu"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-accent-foreground shadow-[var(--elev-1)]"
                  style={{ background: 'var(--gradient-accent)' }}
                >
                  {(userName || userEmail).charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block max-w-[10rem] truncate text-sm font-medium text-foreground">
                  {userName || userEmail}
                </span>
                <ChevronDown className="hidden sm:block h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                {userName && (
                  <p className="truncate text-sm font-medium text-foreground">{userName}</p>
                )}
                <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ChatWindow
          messages={messages}
          isLoading={isSending}
          isLoadingHistory={isLoadingMessages}
          onSendMessage={handleSendMessage}
          onSuggestionClick={handleSendMessage}
        />
      </div>
    </div>
  );
}
