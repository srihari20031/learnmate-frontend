import { Page, Route } from '@playwright/test';

/**
 * Stateful mock of the FastAPI backend that the LearnMate frontend talks to.
 *
 * All calls go to `${NEXT_PUBLIC_API_URL}/api/...` (default http://localhost:8000).
 * We intercept `**​/api/**` regardless of origin, so the real backend never needs
 * to run. Routes are matched by the most-recently-registered handler first, so a
 * test can override any single endpoint by calling `page.route(...)` after
 * `mockBackend(...)`.
 */

export const TEST_USER = {
  id: 'user-1',
  email: 'tester@example.com',
  full_name: 'Test Tester',
  is_active: true,
};

export const TEST_TOKEN = 'test-access-token';

export interface MockChat {
  chat_id: string;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Array<{ role: string; content: string; sent_at: string; notion_urls?: string[] }>;
}

export interface MockBackendOptions {
  /** Profile returned by GET /api/auth/me. Set to null to force a 401 (logged out). */
  user?: typeof TEST_USER | null;
  /** Chats the user starts with. Defaults to none. */
  chats?: MockChat[];
  /** Canned assistant reply for POST /api/chat/message. */
  assistantReply?: string;
  /** notion_urls attached to the assistant reply. */
  assistantNotionUrls?: string[];
  /** Initial Notion connection status. */
  notion?: { connected: boolean; workspace_name?: string };
  /** Initial user profile (known stack from résumé). Defaults to empty. */
  profile?: { known_stack: string | null; resume_filename: string | null; updated_at: string | null };
}

export interface MockBackend {
  /** Live view of the server-side chat list (mutated as the UI creates/deletes). */
  chats: MockChat[];
  /** Number of POST /api/chat/message calls received. */
  messageCount: () => number;
}

let chatCounter = 0;
function makeChat(title = 'New Chat'): MockChat {
  chatCounter += 1;
  const id = `session-${chatCounter}`;
  const now = '2026-06-26T10:00:00';
  return {
    chat_id: `chat-${chatCounter}`,
    session_id: id,
    title,
    created_at: now,
    updated_at: now,
    messages: [],
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/** Fulfil a request as an SSE stream: each event becomes a `data: {json}\n\n` frame. */
function sse(route: Route, events: Array<Record<string, unknown>>) {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  return route.fulfill({ status: 200, contentType: 'text/event-stream', body });
}

/**
 * Seed the auth token into sessionStorage before any app code runs.
 * `getCurrentUser()` reads it from sessionStorage on the chat page mount.
 */
export async function seedAuthToken(page: Page, token = TEST_TOKEN) {
  await page.addInitScript((t) => {
    sessionStorage.setItem('access_token', t as string);
  }, token);
}

export async function mockBackend(page: Page, options: MockBackendOptions = {}): Promise<MockBackend> {
  const {
    user = TEST_USER,
    chats = [],
    assistantReply = 'Great! Let us start learning. Here is your first lesson.',
    assistantNotionUrls = [],
    notion = { connected: false },
    profile = { known_stack: null, resume_filename: null, updated_at: null },
  } = options;

  const state = {
    chats: chats.map((c) => ({ ...c })),
    messages: 0,
    notion: { ...notion },
    profile: { ...profile },
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    // ── Health ────────────────────────────────────────────────────────────
    if (path.endsWith('/api/health')) {
      return json(route, { status: 'ok' });
    }

    // ── Auth ──────────────────────────────────────────────────────────────
    if (path.endsWith('/api/auth/token') && method === 'POST') {
      return json(route, { access_token: TEST_TOKEN, token_type: 'bearer' });
    }
    if (path.endsWith('/api/auth/register') && method === 'POST') {
      const payload = request.postDataJSON?.() ?? {};
      return json(route, {
        id: 'new-user',
        email: payload.email ?? 'new@example.com',
        full_name: payload.full_name ?? '',
        is_active: true,
      });
    }
    if (path.endsWith('/api/auth/me')) {
      if (!user) return json(route, { detail: 'Not authenticated' }, 401);
      return json(route, user);
    }
    if (path.endsWith('/api/auth/logout') && method === 'POST') {
      return json(route, { success: true });
    }

    // ── Chat sessions ───────────────────────────────────────────────────────
    if (path.endsWith('/api/chat/chats') && method === 'POST') {
      const payload = request.postDataJSON?.() ?? {};
      const chat = makeChat(payload.title ?? 'New Chat');
      state.chats.unshift(chat);
      return json(route, chat);
    }
    if (path.endsWith('/api/chat/chats') && method === 'GET') {
      return json(route, { chats: state.chats });
    }
    // PATCH /api/chat/chats/:id/title
    const titleMatch = path.match(/\/api\/chat\/chats\/([^/]+)\/title$/);
    if (titleMatch && method === 'PATCH') {
      const payload = request.postDataJSON?.() ?? {};
      const chat = state.chats.find((c) => c.session_id === decodeURIComponent(titleMatch[1]));
      if (chat && payload.title) chat.title = payload.title;
      return json(route, { success: true });
    }
    // GET /api/chat/session/:id
    const sessionMatch = path.match(/\/api\/chat\/session\/([^/]+)$/);
    if (sessionMatch && method === 'GET') {
      const chat = state.chats.find((c) => c.session_id === decodeURIComponent(sessionMatch[1]));
      return json(route, { messages: chat?.messages ?? [], session_id: sessionMatch[1] });
    }
    // Streaming send (primary path). Emits sources → delta → done as SSE frames.
    if (path.endsWith('/api/chat/message/stream') && method === 'POST') {
      state.messages += 1;
      return sse(route, [
        { type: 'sources', sources: [] },
        { type: 'delta', text: assistantReply },
        {
          type: 'done',
          response: assistantReply,
          status: 'completed',
          notion_urls: assistantNotionUrls,
          sources: [],
        },
      ]);
    }
    // Non-streaming send (fallback path).
    if (path.endsWith('/api/chat/message') && method === 'POST') {
      state.messages += 1;
      return json(route, {
        response: assistantReply,
        status: 'completed',
        notion_urls: assistantNotionUrls,
      });
    }
    // Async document upload — returns 202 instantly with a document_id to poll.
    if (path.endsWith('/api/chat/upload') && method === 'POST') {
      return json(
        route,
        {
          document_id: 'doc-mock-1',
          filename: 'uploaded.pdf',
          type: 'document',
          status: 'processing',
        },
        202
      );
    }
    // Document indexing status — defaults to ready. Tests override for other states.
    const docStatusMatch = path.match(/\/api\/documents\/([^/]+)\/status$/);
    if (docStatusMatch && method === 'GET') {
      return json(route, {
        document_id: decodeURIComponent(docStatusMatch[1]),
        filename: 'uploaded.pdf',
        status: 'ready',
        chunk_count: 3,
        uploaded_at: '2026-06-26T10:00:00',
      });
    }
    // POST /api/chat/reset/:id
    const resetMatch = path.match(/\/api\/chat\/reset\/([^/]+)$/);
    if (resetMatch && method === 'POST') {
      const id = decodeURIComponent(resetMatch[1]);
      state.chats = state.chats.filter((c) => c.session_id !== id);
      return json(route, { success: true });
    }

    // ── Notion ───────────────────────────────────────────────────────────────
    if (path.endsWith('/api/notion/connect')) {
      const redirect = url.searchParams.get('redirect_uri') ?? 'http://localhost:3000/notion/callback';
      return json(route, {
        authorization_url: `${redirect}?code=mock-code&state=mock-state`,
      });
    }
    if (path.endsWith('/api/notion/status')) {
      return json(route, state.notion);
    }
    if (path.endsWith('/api/notion/disconnect') && method === 'POST') {
      state.notion = { connected: false };
      return json(route, { success: true });
    }
    if (path.endsWith('/api/notion/callback') && method === 'POST') {
      state.notion = { connected: true, workspace_name: 'My Workspace' };
      return json(route, { success: true });
    }
    if (path.endsWith('/api/notion/create-topic') && method === 'POST') {
      return json(route, { status: 'ok', notion_url: 'https://notion.so/mock-page' });
    }

    // ── Profile / résumé ─────────────────────────────────────────────────────
    if (path.endsWith('/api/profile/resume') && method === 'POST') {
      state.profile = {
        known_stack: 'Python, FastAPI, React',
        resume_filename: 'resume.pdf',
        updated_at: '2026-06-26T10:00:00',
      };
      return json(route, state.profile);
    }
    if (path.endsWith('/api/profile') && method === 'GET') {
      return json(route, state.profile);
    }
    if (path.endsWith('/api/profile') && method === 'DELETE') {
      state.profile = { known_stack: null, resume_filename: null, updated_at: null };
      return json(route, { status: 'ok', message: 'Profile cleared.' });
    }

    // Unknown endpoint — fail loudly so missing mocks surface in tests.
    return json(route, { detail: `Unmocked endpoint: ${method} ${path}` }, 404);
  });

  return {
    get chats() {
      return state.chats;
    },
    messageCount: () => state.messages,
  };
}

/** Convenience: seed the token AND install the backend mock for an authenticated session. */
export async function loginAndMock(page: Page, options: MockBackendOptions = {}): Promise<MockBackend> {
  await seedAuthToken(page);
  return mockBackend(page, options);
}
