import { test, expect } from '@playwright/test';
import { mockBackend, seedAuthToken } from './helpers/mock-api';

/**
 * The résumé file input sits directly after the "My Profile" sidebar trigger,
 * so we target it with an adjacent-sibling selector. Profile UI lives in a
 * Radix dialog (role="dialog"); assertions scope to it to avoid matching the
 * suggestion chips (e.g. "I want to learn FastAPI") on the empty state.
 */
const resumeInput = 'button[aria-label="My Profile"] + input';

test.beforeEach(async ({ page }) => {
  await seedAuthToken(page);
});

test.describe('My Profile', () => {
  test('shows the upload state when no résumé is set', async ({ page }) => {
    await mockBackend(page); // profile empty by default
    await page.goto('/');

    await page.getByRole('button', { name: 'My Profile' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /Upload/ })).toBeVisible();
  });

  test('shows the known stack and résumé filename when a profile exists', async ({ page }) => {
    await mockBackend(page, {
      profile: { known_stack: 'Python, Django', resume_filename: 'cv.pdf', updated_at: '2026-01-01T00:00:00' },
    });
    await page.goto('/');

    await page.getByRole('button', { name: 'My Profile' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Python')).toBeVisible();
    await expect(dialog.getByText('Django')).toBeVisible();
    await expect(dialog.getByText('cv.pdf')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Update/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Clear' })).toBeVisible();
  });

  test('uploading a résumé shows the extracted stack chips', async ({ page }) => {
    await mockBackend(page); // POST /api/profile/resume returns Python, FastAPI, React
    await page.goto('/');

    await page.getByRole('button', { name: 'My Profile' }).click();
    await page.locator(resumeInput).setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('FastAPI')).toBeVisible();
    await expect(dialog.getByText('resume.pdf')).toBeVisible();
  });

  test('shows the backend detail message when the file is not a résumé', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/profile/resume', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ detail: "That doesn't look like a résumé" }),
      })
    );
    await page.goto('/');

    await page.getByRole('button', { name: 'My Profile' }).click();
    await page.locator(resumeInput).setInputFiles({
      name: 'notes.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF'),
    });

    await expect(page.getByRole('dialog').getByText("That doesn't look like a résumé")).toBeVisible();
  });

  test('clearing the profile resets to the upload state', async ({ page }) => {
    await mockBackend(page, {
      profile: { known_stack: 'Go, Rust', resume_filename: 'cv.pdf', updated_at: '2026-01-01T00:00:00' },
    });
    await page.goto('/');

    await page.getByRole('button', { name: 'My Profile' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Go')).toBeVisible();

    await dialog.getByRole('button', { name: 'Clear' }).click();
    await expect(dialog.getByRole('button', { name: /Upload/ })).toBeVisible();
  });

  test('rejects an unsupported file type before uploading', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'My Profile' }).click();
    await page.locator(resumeInput).setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
    });

    await expect(page.getByRole('dialog').getByText(/Unsupported file type/)).toBeVisible();
  });
});
