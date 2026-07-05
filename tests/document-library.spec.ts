import { test, expect } from '@playwright/test';
import { mockBackend, seedAuthToken, MockChat } from './helpers/mock-api';

function chatWith(session_id: string, title: string, reply: string): MockChat {
  return {
    chat_id: `chat-${session_id}`,
    session_id,
    title,
    created_at: '2026-06-26T10:00:00',
    updated_at: '2026-06-26T10:00:00',
    messages: [{ role: 'agent', content: reply, sent_at: '2026-06-26T10:00:05' }],
  };
}

/**
 * The document library uploads to the async POST /api/chat/upload endpoint
 * (HTTP 202) and polls GET /api/documents/{id}/status until the document is
 * indexed. The hidden file input sits directly after the "Add to this chat"
 * button, so we target it with an adjacent-sibling selector.
 */
const libraryInput = 'button[aria-label="Add to this chat"] + input';

test.beforeEach(async ({ page }) => {
  await seedAuthToken(page);
});

test.describe('Document library', () => {
  test('uploads a document, shows Processing, then Ready', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/chat/upload', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ document_id: 'doc-9', filename: 'notes.pdf', type: 'document', status: 'processing' }),
      })
    );
    // First poll: still processing; subsequent polls: ready.
    let polls = 0;
    await page.route('**/api/documents/*/status', (route) => {
      polls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          document_id: 'doc-9',
          filename: 'notes.pdf',
          status: polls === 1 ? 'processing' : 'ready',
          chunk_count: 4,
        }),
      });
    });
    await page.goto('/');

    await page.locator(libraryInput).setInputFiles({
      name: 'notes.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });

    await expect(page.getByText(/Processing/)).toBeVisible();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  });

  test('uploads an image and marks it Uploaded without polling', async ({ page }) => {
    await mockBackend(page);
    let statusCalls = 0;
    await page.route('**/api/documents/*/status', (route) => {
      statusCalls += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready' }) });
    });
    await page.route('**/api/chat/upload', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ filename: 'pic.png', type: 'image', status: 'uploaded' }),
      })
    );
    await page.goto('/');

    await page.locator(libraryInput).setInputFiles({
      name: 'pic.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
    });

    await expect(page.getByText('Uploaded')).toBeVisible();
    // An image has nothing to index — the status endpoint must never be hit.
    expect(statusCalls).toBe(0);
  });

  test('shows a Failed state when indexing fails', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/chat/upload', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ document_id: 'doc-x', filename: 'bad.pdf', type: 'document', status: 'processing' }),
      })
    );
    await page.route('**/api/documents/*/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ document_id: 'doc-x', filename: 'bad.pdf', status: 'failed' }),
      })
    );
    await page.goto('/');

    await page.locator(libraryInput).setInputFiles({
      name: 'bad.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF'),
    });

    await expect(page.getByText('Failed')).toBeVisible();
  });

  test('clears the document list when switching chats', async ({ page }) => {
    // Latest first: chat B loads on startup; chat A is selectable in the list.
    await mockBackend(page, {
      chats: [chatWith('session-b', 'Chat B', 'Answer B'), chatWith('session-a', 'Chat A', 'Answer A')],
    });
    await page.goto('/');

    await page.locator(libraryInput).setInputFiles({
      name: 'notes.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });
    // Default mock echoes the filename as uploaded.pdf once the upload resolves.
    await expect(page.getByText('uploaded.pdf')).toBeVisible();

    // Switch to the other chat — the library must reset to empty.
    await page.getByRole('option', { name: 'Chat A' }).click();
    await expect(page.getByText('uploaded.pdf')).not.toBeVisible();
  });

  test('rejects an unsupported file type', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/');

    await page.locator(libraryInput).setInputFiles({
      name: 'evil.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('MZ'),
    });

    await expect(page.getByText('Unsupported file type', { exact: false })).toBeVisible();
  });
});
