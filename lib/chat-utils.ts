import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  status?: 'chatting' | 'completed';
  notionUrls?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messageCount: number;
}

export const generateSessionId = (): string => {
  return uuidv4();
};

export const createMessage = (
  content: string,
  role: 'user' | 'agent',
  status?: 'chatting' | 'completed',
  notionUrls?: string[]
): Message => {
  return {
    id: uuidv4(),
    role,
    content,
    timestamp: Date.now(),
    status,
    notionUrls,
  };
};

export const truncateTitle = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const formatTimestamp = (timestamp: number): string => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffMs = now.getTime() - messageTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return messageTime.toLocaleDateString();
};
