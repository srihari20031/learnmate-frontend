'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ChatWindow } from '@/components/chat/chat-window';
import { Sidebar } from '@/components/chat/sidebar';
import {
  generateSessionId,
  createMessage,
  truncateTitle,
  Message,
  ChatSession,
} from '@/lib/chat-utils';

export default function ChatPage() {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setActiveSessionId(newSessionId);
  }, []);

  const handleSendMessage = useCallback(
    async (userMessage: string) => {
      if (!sessionId || !userMessage.trim()) return;

      try {
        // Add user message to UI immediately
        const userMsg = createMessage(userMessage, 'user');
        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        // Make API call
        const response = await fetch('http://localhost:8000/api/learn/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'session-id': sessionId,
          },
          body: JSON.stringify({ message: userMessage }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response from LearnMate');
        }

        const data = await response.json();
        console.log('[v0] API Response:', data);

        // Add agent response to UI
        const agentMsg = createMessage(
          data.response,
          'agent',
          data.status,
          data.notion_urls
        );
        setMessages((prev) => [...prev, agentMsg]);

        // Update session list if it's a new conversation
        if (!sessions.find((s) => s.id === sessionId)) {
          const newSession: ChatSession = {
            id: sessionId,
            title: truncateTitle(userMessage),
            createdAt: Date.now(),
            messageCount: 2,
          };
          setSessions((prev) => [newSession, ...prev]);
        } else {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? { ...s, messageCount: s.messageCount + 2 }
                : s
            )
          );
        }
      } catch (error) {
        console.error('[v0] Error:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to send message',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, sessions, toast]
  );

  const handleNewChat = useCallback(() => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setActiveSessionId(newSessionId);
    setMessages([]);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setSessionId(id);
    // In a real app, you would fetch messages for this session
    setMessages([]);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      handleNewChat();
    }
  }, [activeSessionId, handleNewChat]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Sidebar */}
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

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-50 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-slate-100 transition-all duration-200 border border-slate-700/50"
            title="Open sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          onSuggestionClick={handleSendMessage}
        />
      </div>
    </div>
  );
}
