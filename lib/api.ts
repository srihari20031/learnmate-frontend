/**
 * Thin wrapper around the FastAPI backend auth endpoints.
 *
 * Backend contract (from the API documentation):
 *   GET  /api/health              — health check
 *   POST /api/auth/register       — { email, password, full_name? }
 *                                  → { id, email, full_name, is_active }
 *   POST /api/auth/token          — x-www-form-urlencoded { username, password }
 *                                  → { access_token, token_type }
 *   GET  /api/auth/me             — Authorization: Bearer <token>
 *                                  → current user profile
 *   POST /api/auth/logout         — Authorization: Bearer <token>
 *
 * Notion Public OAuth (user's own workspace, token in MongoDB):
 *   GET  /api/notion/connect      — opens the Notion OAuth consent screen
 *                                  ?redirect_uri=...
 *                                  → { authorization_url: string }
 *   GET  /api/notion/status       — Authorization: Bearer <token>
 *                                  → { connected: bool, workspace_name?: string }
 *   POST /api/notion/disconnect   — Authorization: Bearer <token>
 *                                  → { success: bool }
 *
 * Token is stored in sessionStorage so it's cleared when the tab closes.
 */

import type { Source, NotionPage } from './chat-utils';

type LoginResponse = { access_token: string; token_type: string };
type RegisterResponse = { id: string; email: string; full_name: string; is_active: boolean };

// ── Internal helpers ────────────────────────────────────────────────────────

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('access_token') ?? '';
}

function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('access_token', token);
  }
}

function clearToken(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('access_token');
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>');
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Extract a human-readable message from a FastAPI error response. `detail` is a
 * string for HTTPException (400/422 we raise), or an array of validation errors.
 */
async function errorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const msg = detail.map((e) => e?.msg).filter(Boolean).join('; ');
      return msg || fallback;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export type { LoginResponse, RegisterResponse };

/**
 * The backend origin, e.g. `https://api.example.com`.
 *
 * `NEXT_PUBLIC_*` values are inlined into the bundle at BUILD time, not read at
 * runtime. When the variable is missing at build time the old code interpolated
 * the literal string `undefined`, producing requests to `undefined/api/auth/token`
 * that resolve against the frontend's own origin and 404. Fail loudly instead —
 * and tolerate a trailing slash on the configured value.
 */
export function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not set. Add it to your deployment environment ' +
        '(Vercel → Settings → Environment Variables) and redeploy — NEXT_PUBLIC_* ' +
        'values are baked into the bundle at build time.'
    );
  }
  return base.replace(/\/+$/, '');
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${apiBase()}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  });
  const data = await handleResponse<LoginResponse>(res);
  setToken(data.access_token);
  return data;
}

export async function register(params: { email: string; password: string; full_name?: string }): Promise<RegisterResponse> {
  const res = await fetch(`${apiBase()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse<RegisterResponse>(res);
}

export async function getCurrentUser(signal?: AbortSignal): Promise<{ id: string; email: string; full_name: string; is_active: boolean }> {
  const token = getToken();
  const res = await fetch(`${apiBase()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Authentication failed: ${res.status}`);
  }
  const profile = await res.json();
  return profile;
}

/** Returns the auth headers to attach to any API request that needs a user context. */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Returns `true` when a token is currently stored. */
export function isAuthenticated(): boolean {
  return typeof window !== 'undefined' && !!getToken();
}

/** Logs the user out locally. Call back-end `/logout` if it exists. */
export async function logout(): Promise<void> {
  const token = getToken();
  try {
    await fetch(`${apiBase()}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  } finally {
    clearToken();
  }
}

// ── Document library (async upload + status polling) ─────────────────────────
// POST /api/chat/upload returns instantly (HTTP 202). A document then indexes in
// the background — poll GET /api/documents/{id}/status until it is ready. An
// image has nothing to index and comes back already done. Branch on the body's
// type/status, NOT the HTTP code (202 for both).

export interface UploadResponse {
  /** Present for documents (used to poll status). Absent for images. */
  document_id?: string;
  filename: string;
  type: 'document' | 'image';
  /** "processing" for a document being indexed; "uploaded" for an image. */
  status: 'processing' | 'uploaded' | string;
}

export type DocumentStatus = 'processing' | 'ready' | 'failed';

export interface DocumentStatusResponse {
  document_id: string;
  filename: string;
  status: DocumentStatus;
  chunk_count?: number;
  uploaded_at?: string;
}

export async function uploadFile(
  sessionId: string,
  file: File
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${apiBase()}/api/chat/upload`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'session-id': sessionId,
      // No Content-Type — the browser sets the multipart boundary itself.
    },
    body: formData,
  });
  return handleResponse<UploadResponse>(res);
}

/** Poll the indexing status of an uploaded document. */
export async function getDocumentStatus(
  documentId: string
): Promise<DocumentStatusResponse> {
  const res = await fetch(
    `${apiBase()}/api/documents/${encodeURIComponent(documentId)}/status`,
    { headers: authHeaders() }
  );
  return handleResponse<DocumentStatusResponse>(res);
}

export interface DeleteDocumentResponse {
  deleted: boolean;
  filename?: string;
  chunks?: number;
}

/**
 * Permanently un-index a document — removes its Qdrant vectors, Mongo chunks and
 * metadata. Auth-scoped to the caller's own documents.
 *
 * A 404 means the document is already gone, which is not an error from the UI's
 * point of view: the caller should drop the row either way. Any other non-2xx
 * throws with the backend's `detail` message so it can be surfaced inline.
 */
export async function deleteDocument(
  documentId: string
): Promise<DeleteDocumentResponse> {
  const res = await fetch(
    `${apiBase()}/api/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE', headers: authHeaders() }
  );

  if (res.status === 404) return { deleted: false }; // already gone — treat as success
  if (!res.ok) {
    throw new Error(await errorDetail(res, `Could not delete document (${res.status}).`));
  }
  return res.json() as Promise<DeleteDocumentResponse>;
}

// ── Learn flow ───────────────────────────────────────────────────────────────

export interface LearnMessageResponse {
  response: string;
  session_id: string;
  status: 'chatting' | 'completed';
  notion_urls: string[];
}

export async function sendLearnMessage(
  sessionId: string,
  message: string
): Promise<LearnMessageResponse> {
  const res = await fetch(`${apiBase()}/api/learn/message`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      'session-id': sessionId,
    },
    body: JSON.stringify({ message }),
  });
  return handleResponse<LearnMessageResponse>(res);
}

// ── Async note generation ────────────────────────────────────────────────────
// A turn that generates notes returns immediately with status "generating_notes".
// The notes are produced in the background — poll this until the job resolves.

export interface NotesStatusResponse {
  status: 'generating' | 'completed' | 'failed';
  notion_pages: NotionPage[];
}

/**
 * Poll the status of the background note-generation job for a session. Note the
 * session id goes in a `session_id` header (underscore), matching this endpoint's
 * contract — not the `session-id` header the chat endpoints use.
 */
export async function getNotesStatus(sessionId: string): Promise<NotesStatusResponse> {
  const res = await fetch(`${apiBase()}/api/learn/notes-status`, {
    headers: {
      ...authHeaders(),
      session_id: sessionId,
    },
  });
  return handleResponse<NotesStatusResponse>(res);
}

// ── Notion Public OAuth ──────────────────────────────────────────────────────
// User authorises against their own Notion workspace.
// Backend exchanges the code and stores the resulting token in MongoDB.

export interface NotionConnectResponse {
  authorization_url: string;
}

export interface NotionStatusResponse {
  connected: boolean;
  workspace_name?: string;
}

export interface NotionDisconnectResponse {
  success: boolean;
}

// ── Chat sessions ───────────────────────────────────────────────────────────

export interface ChatSessionResponse {
  chat_id: string;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatListResponse {
  chats: ChatSessionResponse[];
}

export interface ChatMessageResponse {
  role?: string;
  content: string;
  sent_at?: string | null;
  notion_urls?: string[];
  // Optional richer fields — rendered on reload once the backend persists them
  // with each stored message (see backend note).
  notion_pages?: NotionPage[];
  sources?: Source[];
  attachments?: Array<{
    id?: string;
    filename: string;
    type: 'document' | 'image';
    mime_type?: string;
    base64?: string;
  }>;
}

export interface ChatMessagesResponse {
  messages: ChatMessageResponse[];
  session_id?: string;
}

export interface MessageResponse {
  response: string;
  session_id?: string;
  status?: 'chatting' | 'completed' | 'generating_notes';
  notion_urls?: string[];
}

export interface UpdateChatTitleRequest {
  title: string;
}

export interface UpdateChatTitleResponse {
  success: boolean;
}

export interface ResetChatResponse {
  success: boolean;
  message?: string;
}

export async function updateChatTitle(
  sessionId: string,
  title: string
): Promise<UpdateChatTitleResponse> {
  const res = await fetch(
    `${apiBase()}/api/chat/chats/${encodeURIComponent(sessionId)}/title`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    }
  );
  return handleResponse<UpdateChatTitleResponse>(res);
}

export async function createChat(title = 'New Chat'): Promise<ChatSessionResponse> {
  const res = await fetch(`${apiBase()}/api/chat/chats`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  return handleResponse<ChatSessionResponse>(res);
}

export async function listChats(): Promise<ChatListResponse> {
  const res = await fetch(`${apiBase()}/api/chat/chats`, {
    headers: authHeaders(),
  });
  return handleResponse<ChatListResponse>(res);
}

export async function getMessages(sessionId: string): Promise<ChatMessagesResponse> {
  const res = await fetch(`${apiBase()}/api/chat/session/${encodeURIComponent(sessionId)}`, {
    headers: authHeaders(),
  });
  return handleResponse<ChatMessagesResponse>(res);
}

export async function sendMessage(
  sessionId: string,
  message: string,
  files?: File[]
): Promise<MessageResponse> {
  // The backend endpoint uses FastAPI Form(...)/File(...), so it expects
  // multipart/form-data on every request — even a text-only message. Always
  // send FormData; attach files when present.
  const formData = new FormData();
  formData.append('message', message);
  files?.forEach((file) => formData.append('attachments', file));

  const res = await fetch(`${apiBase()}/api/chat/message`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'session-id': sessionId,
      // Do NOT set Content-Type — the browser sets it with the multipart
      // boundary automatically.
    },
    body: formData,
  });
  return handleResponse<MessageResponse>(res);
}

// ── Streaming chat (SSE) ──────────────────────────────────────────────────────
// POST /api/chat/message/stream streams the reply as Server-Sent Events. We read
// the body manually via getReader() rather than EventSource, because EventSource
// cannot attach the Authorization: Bearer header our auth requires.

export interface StreamDoneEvent {
  response: string;
  status?: string;
  notion_urls?: string[];
  /** Optional: saved pages with titles. Falls back to notion_urls when absent. */
  notion_pages?: NotionPage[];
  sources?: Source[];
}

export interface StreamHandlers {
  /** Retrieved sources — arrive before any text. */
  onSources?: (sources: Source[]) => void;
  /** A token chunk. `fullText` is the accumulated reply so far. */
  onDelta?: (fullText: string, chunk: string) => void;
  /** Post-answer status, e.g. "generating_notes". */
  onStatus?: (status: string) => void;
  /** Authoritative final state. */
  onDone?: (evt: StreamDoneEvent) => void;
  /** An error frame emitted by the server mid-stream. */
  onError?: (message: string) => void;
}

/**
 * Consume the SSE stream for a chat message. Resolves when the stream ends.
 * Throws if the connection can't be established (non-2xx or no body) so the
 * caller can fall back to the non-streaming {@link sendMessage} endpoint.
 */
export async function sendMessageStream(
  sessionId: string,
  message: string,
  files: File[] | undefined,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData();
  formData.append('message', message);
  files?.forEach((file) => formData.append('attachments', file));

  const res = await fetch(`${apiBase()}/api/chat/message/stream`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'session-id': sessionId,
      // No Content-Type — the browser sets the multipart boundary itself.
    },
    body: formData,
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '<no body>');
    throw new Error(`Stream error ${res.status}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  const handleFrame = (frame: string) => {
    // A frame may contain multiple lines; the payload is the `data: ` line.
    const line = frame.split('\n').find((l) => l.startsWith('data: '));
    if (!line) return;

    let evt: { type?: string; [k: string]: unknown };
    try {
      evt = JSON.parse(line.slice(6));
    } catch {
      return; // ignore malformed frame
    }

    switch (evt.type) {
      case 'sources':
        handlers.onSources?.((evt.sources as Source[]) ?? []);
        break;
      case 'delta': {
        const chunk = (evt.text as string) ?? '';
        fullText += chunk;
        handlers.onDelta?.(fullText, chunk);
        break;
      }
      case 'status':
        handlers.onStatus?.((evt.status as string) ?? '');
        break;
      case 'done':
        handlers.onDone?.({
          response: (evt.response as string) ?? fullText,
          status: evt.status as string | undefined,
          notion_urls: (evt.notion_urls as string[]) ?? [],
          notion_pages: (evt.notion_pages as NotionPage[]) ?? undefined,
          sources: (evt.sources as Source[]) ?? undefined,
        });
        break;
      case 'error':
        handlers.onError?.((evt.message as string) ?? 'Streaming failed.');
        break;
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? ''; // keep the trailing partial frame
    for (const frame of frames) handleFrame(frame);
  }

  // Flush any complete frame left in the buffer after the stream closes.
  const tail = buffer.trim();
  if (tail) handleFrame(tail);
}

export async function resetChat(sessionId: string): Promise<ResetChatResponse> {
  const res = await fetch(`${apiBase()}/api/chat/reset/${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse<ResetChatResponse>(res);
}

/**
 * Fetch the URL to begin the Notion OAuth public-integration flow.
 * The returned URL opens the Notion consent screen. After authorisation
 * the browser is redirected back to the frontend callback page, where a
 * lightweight poll loop detects the saved token.
 */
export async function getNotionConnectUrl(): Promise<NotionConnectResponse> {
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/notion/callback`
    : process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/notion/callback`
      : undefined;

  const url = new URL(`${apiBase()}/api/notion/connect`);
  if (redirectUri) {
    url.searchParams.set('redirect_uri', redirectUri);
  }

  const res = await fetch(url.toString(), {
    headers: authHeaders(),
  });
  return handleResponse<NotionConnectResponse>(res);
}

/**
 * Check the current Notion connection status for the authenticated user.
 * Backend reads the saved token from MongoDB to verify it is still valid.
 */
export async function getNotionStatus(): Promise<NotionStatusResponse> {
  const res = await fetch(`${apiBase()}/api/notion/status`, { headers: authHeaders() });
  if (!res.ok) {
    // Treat 404 as "not connected" rather than a hard error.
    if (res.status === 404) return { connected: false };
    const text = await res.text().catch(() => '<no body>');
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Disconnect / remove the saved Notion token from MongoDB.
 */
export async function disconnectNotion(): Promise<NotionDisconnectResponse> {
  const res = await fetch(`${apiBase()}/api/notion/disconnect`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse<NotionDisconnectResponse>(res);
}

// ── Notion topic creation ─────────────────────────────────────────────────────

export interface CreateTopicRequest {
  title: string;
  content: string;
  session_id?: string;
}

export interface CreateTopicResponse {
  status: string;
  notion_url: string;
}

export async function createNotionTopic(
  title: string,
  content: string,
  sessionId?: string
): Promise<string> {
  // Backend takes title/content/session_id as query params, not a JSON body.
  const url = new URL(`${apiBase()}/api/notion/create-topic`);
  url.searchParams.set('title', title);
  url.searchParams.set('content', content);
  if (sessionId) url.searchParams.set('session_id', sessionId);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await handleResponse<CreateTopicResponse>(res);
  return data.notion_url;
}

// ── User profile / résumé ─────────────────────────────────────────────────────
// A user-wide profile (their known tech stack), set once from a résumé. This is
// a separate lane from /api/chat/upload (per-chat RAG documents).

export interface ProfileResponse {
  /** Comma-separated technologies the user already knows. Null until a résumé is set. */
  known_stack: string | null;
  resume_filename: string | null;
  updated_at: string | null;
}

export interface ResumeUploadResponse {
  known_stack: string;
  resume_filename: string;
  updated_at: string;
}

export interface ClearProfileResponse {
  status: string;
  message?: string;
}

export async function getProfile(): Promise<ProfileResponse> {
  const res = await fetch(`${apiBase()}/api/profile`, { headers: authHeaders() });
  return handleResponse<ProfileResponse>(res);
}

/**
 * Upload a résumé to derive the user's known stack. The backend runs an LLM
 * extraction (a few seconds). Throws with the backend's `detail` message on
 * 422 (not a résumé) or 400 (not a document) so the caller can show it inline.
 */
export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${apiBase()}/api/profile/resume`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      // No Content-Type — the browser sets the multipart boundary itself.
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await errorDetail(res, `Upload failed (${res.status}).`));
  }
  return res.json() as Promise<ResumeUploadResponse>;
}

export async function clearProfile(): Promise<ClearProfileResponse> {
  const res = await fetch(`${apiBase()}/api/profile`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse<ClearProfileResponse>(res);
}
