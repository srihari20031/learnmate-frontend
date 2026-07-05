import { test, expect, Page } from '@playwright/test';
import { mockBackend, seedAuthToken, MockChat } from './helpers/mock-api';

/**
 * Locate text inside a chat message bubble specifically.
 *
 * Message content is rendered by ReactMarkdown inside a `.prose` container,
 * whereas sidebar conversation titles are plain spans. Because the first
 * message of a chat also becomes its sidebar title, a bare `getByText` would
 * match both places — so message assertions are scoped to `.prose`.
 */
const bubble = (page: Page, text: string | RegExp) => page.locator('.prose', { hasText: text });

function existingChat(overrides: Partial<MockChat> = {}): MockChat {
  return {
    chat_id: 'chat-seed',
    session_id: 'session-seed',
    title: 'Learning Docker',
    created_at: '2026-06-20T09:00:00',
    updated_at: '2026-06-20T09:00:00',
    messages: [
      { role: 'user', content: 'Teach me Docker', sent_at: '2026-06-20T09:00:00' },
      { role: 'agent', content: 'Docker is a containerization platform.', sent_at: '2026-06-20T09:00:05' },
    ],
    ...overrides,
  };
}

test.beforeEach(async ({ page }) => {
  await seedAuthToken(page);
});

test.describe('Empty state', () => {
  test('shows the welcome screen and suggestion chips for a fresh user', async ({ page }) => {
    await mockBackend(page); // no chats → app auto-creates an empty one
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'LearnMate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'I want to learn FastAPI' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Teach me Docker' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Help me learn Redis' })).toBeVisible();
  });

  test('clicking a suggestion sends it as a message', async ({ page }) => {
    const backend = await mockBackend(page, { assistantReply: 'Let us learn FastAPI together!' });
    await page.goto('/');

    await page.getByRole('button', { name: 'I want to learn FastAPI' }).click();

    await expect(bubble(page, 'I want to learn FastAPI')).toBeVisible();
    await expect(bubble(page, 'Let us learn FastAPI together!')).toBeVisible();
    expect(backend.messageCount()).toBe(1);
  });
});

test.describe('Sending messages', () => {
  test('sends a typed message with Enter and shows the reply', async ({ page }) => {
    await mockBackend(page, { assistantReply: 'Redis is an in-memory data store.' });
    await page.goto('/');

    const input = page.getByPlaceholder('Message LearnMate...');
    await input.fill('Tell me about Redis');
    await input.press('Enter');

    await expect(bubble(page, 'Tell me about Redis')).toBeVisible();
    await expect(bubble(page, 'Redis is an in-memory data store.')).toBeVisible();
  });

  test('sends a message with the send button', async ({ page }) => {
    await mockBackend(page, { assistantReply: 'Sure thing.' });
    await page.goto('/');

    await page.getByPlaceholder('Message LearnMate...').fill('Hello there');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(bubble(page, 'Hello there')).toBeVisible();
    await expect(bubble(page, 'Sure thing.')).toBeVisible();
  });

  test('Shift+Enter inserts a newline instead of sending', async ({ page }) => {
    const backend = await mockBackend(page);
    await page.goto('/');

    const input = page.getByPlaceholder('Message LearnMate...');
    await input.fill('first line');
    await input.press('Shift+Enter');
    await input.type('second line');

    expect(await input.inputValue()).toContain('\n');
    expect(backend.messageCount()).toBe(0);
  });

  test('send button is inert until text is entered', async ({ page }) => {
    const backend = await mockBackend(page);
    await page.goto('/');

    // The send button is not natively `disabled`; it is made inert via CSS
    // (pointer-events: none) while the composer is empty.
    const send = page.getByRole('button', { name: 'Send message' });
    await expect(send).toHaveCSS('pointer-events', 'none');
    await send.click({ force: true });
    expect(backend.messageCount()).toBe(0);

    await page.getByPlaceholder('Message LearnMate...').fill('hi');
    await expect(send).toHaveCSS('pointer-events', 'auto');
  });

  test('streams the reply token-by-token and renders citation chips', async ({ page }) => {
    await mockBackend(page);
    // Override the stream endpoint with multi-token output + sources.
    await page.route('**/api/chat/message/stream', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body:
          `data: ${JSON.stringify({
            type: 'sources',
            sources: [{ id: 's1', filename: 'redis-guide.pdf', snippet: 'Redis basics', chunk_id: 'c1', cited: false }],
          })}\n\n` +
          `data: ${JSON.stringify({ type: 'delta', text: 'Redis ' })}\n\n` +
          `data: ${JSON.stringify({ type: 'delta', text: 'is fast.' })}\n\n` +
          `data: ${JSON.stringify({
            type: 'done',
            response: 'Redis is fast.',
            status: 'completed',
            notion_urls: [],
            sources: [{ id: 's1', filename: 'redis-guide.pdf', snippet: 'Redis basics', chunk_id: 'c1', cited: true }],
          })}\n\n`,
      })
    );
    await page.goto('/');

    await page.getByPlaceholder('Message LearnMate...').fill('Tell me about Redis');
    await page.getByRole('button', { name: 'Send message' }).click();

    // The two deltas concatenate into the final bubble text.
    await expect(bubble(page, 'Redis is fast.')).toBeVisible();
    // The cited source renders as a citation chip.
    await expect(page.getByText('redis-guide.pdf')).toBeVisible();
  });

  test('renders an assistant Notion card when the reply links a page', async ({ page }) => {
    await mockBackend(page, {
      assistantReply: 'I saved your notes.',
      assistantNotionUrls: ['https://www.notion.so/My-Notes-abc123'],
    });
    await page.goto('/');

    await page.getByPlaceholder('Message LearnMate...').fill('save my notes');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(bubble(page, 'I saved your notes.')).toBeVisible();
    const card = page.getByRole('link', { name: /notion/i });
    await expect(card.first()).toBeVisible();
    await expect(card.first()).toHaveAttribute('href', 'https://www.notion.so/My-Notes-abc123');
  });
});

test.describe('Loading existing conversations', () => {
  test('loads the latest chat and its message history on startup', async ({ page }) => {
    await mockBackend(page, { chats: [existingChat()] });
    await page.goto('/');

    await expect(bubble(page, 'Teach me Docker')).toBeVisible();
    await expect(bubble(page, 'Docker is a containerization platform.')).toBeVisible();
    // The chat shows in the sidebar list.
    await expect(page.getByRole('option', { name: /Learning Docker/ })).toBeVisible();
  });
});

test.describe('File attachments', () => {
  test('attaches a valid file and shows a removable chip', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/');

    await page.getByTestId('composer-file-input').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('some notes'),
    });

    await expect(page.getByText('notes.txt')).toBeVisible();

    await page.getByRole('button', { name: 'Dismiss attachment' }).click();
    await expect(page.getByText('notes.txt')).not.toBeVisible();
  });

  test('rejects an unsupported file type with an error', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/');

    await page.getByTestId('composer-file-input').setInputFiles({
      name: 'evil.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('MZ'),
    });

    // Next renders an empty route-announcer with role="alert"; scope to the
    // composer error which carries the actual message.
    await expect(page.getByText('Unsupported file type', { exact: false })).toBeVisible();
  });

  test('sends a message together with an attachment', async ({ page }) => {
    const backend = await mockBackend(page, { assistantReply: 'Got your file.' });
    await page.goto('/');

    await page.getByTestId('composer-file-input').setInputFiles({
      name: 'doc.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });
    await page.getByPlaceholder('Message LearnMate...').fill('Summarize this');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(bubble(page, 'Summarize this')).toBeVisible();
    await expect(bubble(page, 'Got your file.')).toBeVisible();
    expect(backend.messageCount()).toBe(1);
  });
});

test.describe('Sidebar session management', () => {
  test('reload lands on an existing empty chat without creating a new one', async ({ page }) => {
    const empty = existingChat({ session_id: 'session-empty', title: 'New Chat', messages: [] });
    const backend = await mockBackend(page, { chats: [empty] });
    await page.goto('/');

    // Lands on the empty chat (empty state), and no extra chat was created.
    await expect(page.getByRole('button', { name: 'I want to learn FastAPI' })).toBeVisible();
    expect(backend.chats.length).toBe(1);
  });

  test('New Chat reuses the existing empty chat instead of duplicating it', async ({ page }) => {
    const empty = existingChat({ session_id: 'session-empty', title: 'New Chat', messages: [] });
    const backend = await mockBackend(page, { chats: [empty] });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'I want to learn FastAPI' })).toBeVisible();

    await page.getByRole('button', { name: 'New Chat', exact: true }).click();
    // Still one chat — the empty one was reused, not duplicated.
    expect(backend.chats.length).toBe(1);
  });

  test('creates a new chat from the sidebar', async ({ page }) => {
    const backend = await mockBackend(page, { chats: [existingChat()] });
    await page.goto('/');

    await expect(page.getByRole('option', { name: /Learning Docker/ })).toBeVisible();

    await page.getByRole('button', { name: 'New Chat', exact: true }).click();

    // A brand new empty session is created and selected → empty state appears.
    await expect(page.getByRole('button', { name: 'I want to learn FastAPI' })).toBeVisible();
    expect(backend.chats.length).toBe(2);
  });

  test('switches between conversations', async ({ page }) => {
    const chatA = existingChat({
      session_id: 'session-a',
      title: 'Topic A',
      messages: [{ role: 'agent', content: 'Answer about A', sent_at: '2026-06-20T09:00:00' }],
    });
    const chatB = existingChat({
      session_id: 'session-b',
      title: 'Topic B',
      messages: [{ role: 'agent', content: 'Answer about B', sent_at: '2026-06-21T09:00:00' }],
    });
    // Latest first: chatB loads on startup.
    await mockBackend(page, { chats: [chatB, chatA] });
    await page.goto('/');

    await expect(bubble(page, 'Answer about B')).toBeVisible();

    await page.getByRole('option', { name: 'Topic A' }).click();
    await expect(bubble(page, 'Answer about A')).toBeVisible();
    await expect(bubble(page, 'Answer about B')).not.toBeVisible();
  });

  test('deletes a conversation', async ({ page }) => {
    const backend = await mockBackend(page, { chats: [existingChat({ title: 'Disposable Chat' })] });
    await page.goto('/');

    const option = page.getByRole('option', { name: /Disposable Chat/ });
    await expect(option).toBeVisible();

    await option.hover();
    await page.getByRole('button', { name: /Delete Disposable Chat/ }).click();

    // Deleting the active chat triggers creation of a fresh empty session.
    await expect(page.getByRole('option', { name: /Disposable Chat/ })).not.toBeVisible();
    expect(backend.chats.some((c) => c.title === 'Disposable Chat')).toBe(false);
  });

  test('toggles the sidebar open and closed on desktop', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/');

    // The header toggle reflects sidebar state via aria-expanded. The desktop
    // sidebar collapses by animating its width to 0 (content stays clipped in
    // the DOM), so aria-expanded is the reliable signal rather than visibility.
    const headerToggle = page.locator('header button, div > button[aria-expanded]').first();
    await expect(headerToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'New Chat', exact: true })).toBeVisible();

    await headerToggle.click();
    await expect(headerToggle).toHaveAttribute('aria-expanded', 'false');

    await headerToggle.click();
    await expect(headerToggle).toHaveAttribute('aria-expanded', 'true');
  });
});
