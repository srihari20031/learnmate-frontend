import { v4 as uuidv4 } from 'uuid';

export interface Attachment {
  filename: string;
  type: 'document' | 'image';
  mime_type?: string;
  base64?: string;
}

/** A retrieved context chunk surfaced as a citation chip on an assistant turn. */
export interface Source {
  id: string;
  filename: string;
  snippet: string;
  chunk_id: string;
  cited: boolean;
}

/** A saved Notion page with its topic title (authoritative, from the backend). */
export interface NotionPage {
  title: string;
  url: string;
}

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  status?: 'chatting' | 'completed';
  notionUrls?: string[];
  /** Saved Notion pages with topic titles. Preferred over `notionUrls` when present. */
  notionPages?: NotionPage[];
  attachments?: Attachment[];
  /** Citation chips streamed alongside the assistant reply. */
  sources?: Source[];
  /** True while the backend is generating Notion notes (post-answer step). */
  generatingNotes?: boolean;
  /** Set when the stream reports an error frame or is interrupted. */
  error?: string;
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

/**
 * The backend persists user messages with the uploaded document's extracted
 * text appended to the typed message, marked by an `[Attached file: …]` block.
 * That dump is meant for LLM context, not display — strip it so the bubble
 * shows only what the user actually typed. The file itself is still surfaced
 * separately via `attachments[]` (rendered as a chip).
 */
const ATTACHMENT_MARKER = /\n*\[Attached file:/i;

export const stripExtractedContent = (content: string): string => {
  if (!content) return content;
  const match = content.match(ATTACHMENT_MARKER);
  if (!match || match.index === undefined) return content;
  return content.slice(0, match.index).trim();
};

/**
 * A human-friendly label for an attachment — never the raw MIME type.
 * Prefers the file extension (PDF, DOCX, PNG…), falling back to a generic
 * "Document" / "Image" so internal types like `octet-stream` never surface.
 */
export const friendlyFileType = (
  filename: string,
  mimeType?: string,
  type?: 'document' | 'image'
): string => {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toUpperCase() : '';
  if (ext && ext.length <= 5 && !/octet/i.test(ext)) return ext;

  const sub = mimeType?.split('/')[1];
  if (sub && !/octet-stream/i.test(sub)) return sub.toUpperCase();

  return type === 'image' ? 'Image' : 'Document';
};

/**
 * Bucket a session's timestamp into a coarse, human label used as a section
 * heading in the chat list ("Today", "Yesterday", "Previous 7 days"…).
 */
export const groupLabelForDate = (timestamp: number): string => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86_400_000;

  if (timestamp >= startOfToday) return 'Today';
  if (timestamp >= startOfToday - dayMs) return 'Yesterday';
  if (timestamp >= startOfToday - 7 * dayMs) return 'Previous 7 days';
  if (timestamp >= startOfToday - 30 * dayMs) return 'Previous 30 days';
  return 'Older';
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
