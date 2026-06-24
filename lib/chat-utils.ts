import { v4 as uuidv4 } from 'uuid';

export interface Attachment {
  filename: string;
  type: 'document' | 'image';
  mime_type?: string;
  base64?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  status?: 'chatting' | 'completed';
  notionUrls?: string[];
  attachments?: Attachment[];
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
  notionUrls?: string[],
  attachments?: Message['attachments']
): Message => {
  return {
    id: uuidv4(),
    role,
    content,
    timestamp: Date.now(),
    status,
    notionUrls,
    attachments,
  };
};

export const truncateTitle = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const formatTimestamp = (timestamp: number): string => {
  const now = new Date();
  const messageTime = new Date(timestamp);

  const isToday =
    now.getFullYear() === messageTime.getFullYear() &&
    now.getMonth() === messageTime.getMonth() &&
    now.getDate() === messageTime.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === messageTime.getFullYear() &&
    yesterday.getMonth() === messageTime.getMonth() &&
    yesterday.getDate() === messageTime.getDate();

  const timeStr = messageTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;

  // Within the current year — show "Jun 19 at 3:21 PM"
  if (now.getFullYear() === messageTime.getFullYear()) {
    const dateStr = messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr} at ${timeStr}`;
  }

  // Older — show "Jun 19, 2025 at 3:21 PM"
  const dateStr = messageTime.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${dateStr} at ${timeStr}`;
};
