'use client';

import { Plus, MessageSquare, Trash2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatSession } from '@/lib/chat-utils';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onToggle: () => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onToggle,
}: SidebarProps) {
  return (
    <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-700/50 flex flex-col h-full backdrop-blur animate-slide-in">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between gap-2">
        <Button
          onClick={onNewChat}
          className="flex-1 justify-start gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white border-0 shadow-lg hover:shadow-blue-500/30 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition-all duration-200"
          title="Close sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            No chat history yet
          </p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                activeSessionId === session.id
                  ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-500/50'
                  : 'hover:bg-slate-800/50 border border-transparent hover:border-slate-700/50'
              }`}
              onClick={() => onSelectSession(session.id)}
            >
              <MessageSquare className={`w-4 h-4 flex-shrink-0 ${activeSessionId === session.id ? 'text-blue-300' : 'text-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${activeSessionId === session.id ? 'text-slate-100' : 'text-slate-300'}`}>
                  {session.title}
                </p>
                <p className={`text-xs ${activeSessionId === session.id ? 'text-slate-400' : 'text-slate-500'}`}>
                  {session.messageCount} messages
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="text-xs text-slate-500 text-center flex items-center justify-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 animate-pulse"></div>
          <span>LearnMate v1.0</span>
        </div>
      </div>
    </aside>
  );
}
