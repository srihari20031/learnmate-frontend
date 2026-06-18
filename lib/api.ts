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

export type { LoginResponse, RegisterResponse };

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  });
  const data = await handleResponse<LoginResponse>(res);
  setToken(data.access_token);
  return data;
}

export async function register(params: { email: string; password: string; full_name?: string }): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse<RegisterResponse>(res);
}

export async function getCurrentUser(): Promise<{ id: string; email: string; full_name: string; is_active: boolean }> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
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
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  } finally {
    clearToken();
  }
}

// ── Chat upload ────────────────────────────────────────────────────────────

export interface UploadResponse {
  filename: string;
  type: 'document' | 'image';
  status: string;
}

export async function uploadFile(
  sessionId: string,
  file: File
): Promise<UploadResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/chat/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'session-id': sessionId,
    },
    body: formData,
  });
  return handleResponse<UploadResponse>(res);
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
  const res = await fetch(`${API_BASE}/api/learn/message`, {
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
  created_at?: string;
  notion_urls?: string[];
}

export interface ChatMessagesResponse {
  messages: ChatMessageResponse[];
  session_id?: string;
}

export interface MessageResponse {
  response: string;
  session_id?: string;
  status?: 'chatting' | 'completed';
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
    `${API_BASE}/api/chat/chats/${encodeURIComponent(sessionId)}/title`,
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
  const res = await fetch(`${API_BASE}/api/chat/chats`, {
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
  const res = await fetch(`${API_BASE}/api/chat/chats`, {
    headers: authHeaders(),
  });
  return handleResponse<ChatListResponse>(res);
}

export async function getMessages(sessionId: string): Promise<ChatMessagesResponse> {
  const res = await fetch(`${API_BASE}/api/chat/session/${encodeURIComponent(sessionId)}`, {
    headers: authHeaders(),
  });
  return handleResponse<ChatMessagesResponse>(res);
}

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<MessageResponse> {
  const res = await fetch(`${API_BASE}/api/chat/message`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      'session-id': sessionId,
    },
    body: JSON.stringify({ message }),
  });
  return handleResponse<MessageResponse>(res);
}

export async function resetChat(sessionId: string): Promise<ResetChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat/reset/${encodeURIComponent(sessionId)}`, {
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

  const url = new URL(`${API_BASE}/api/notion/connect`);
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
  const res = await fetch(`${API_BASE}/api/notion/status`, { headers: authHeaders() });
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
  const res = await fetch(`${API_BASE}/api/notion/disconnect`, {
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
  const res = await fetch(`${API_BASE}/api/notion/create-topic`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, content, session_id: sessionId }),
  });
  const data = await handleResponse<CreateTopicResponse>(res);
  return data.notion_url;
}
