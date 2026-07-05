import { test, expect } from '@playwright/test';
import { mockBackend, seedAuthToken } from './helpers/mock-api';

test.beforeEach(async ({ page }) => {
  await seedAuthToken(page);
});

test.describe('Notion settings widget (sidebar)', () => {
  test('shows a "Connect Notion" button when not connected', async ({ page }) => {
    await mockBackend(page, { notion: { connected: false } });
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Connect Notion' })).toBeVisible();
  });

  test('shows connected state with workspace name', async ({ page }) => {
    await mockBackend(page, { notion: { connected: true, workspace_name: 'Acme HQ' } });
    await page.goto('/');

    await expect(page.getByText('Connected')).toBeVisible();
    await expect(page.getByText('Acme HQ')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();
  });

  test('clicking Connect navigates to the backend authorization URL', async ({ page }) => {
    await mockBackend(page, { notion: { connected: false } });
    // Point the authorization URL at a stable target. (Using an error param so
    // the callback page does not auto-redirect home, which would race the URL
    // assertion.) This proves the button navigates to whatever the backend
    // returns as authorization_url.
    await page.route('**/api/notion/connect*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authorization_url: 'http://localhost:3000/notion/callback?error=connect_marker',
        }),
      })
    );
    await page.goto('/');

    await page.getByRole('button', { name: 'Connect Notion' }).click();

    await expect(page).toHaveURL(/\/notion\/callback\?error=connect_marker/);
    await expect(page.getByText('connect_marker')).toBeVisible();
  });

  test('disconnects an existing connection', async ({ page }) => {
    await mockBackend(page, { notion: { connected: true, workspace_name: 'Acme HQ' } });
    await page.goto('/');

    await page.getByRole('button', { name: 'Disconnect' }).click();
    await expect(page.getByRole('button', { name: 'Connect Notion' })).toBeVisible();
  });
});

test.describe('Notion OAuth callback page', () => {
  test('completes the exchange and shows success', async ({ page }) => {
    await mockBackend(page, { notion: { connected: false } });
    await page.goto('/notion/callback?code=mock-code&state=mock-state');

    // The POST /callback flips the mocked status to connected → success state.
    await expect(page.getByText('Notion connected!')).toBeVisible();
    // Then it redirects home.
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('shows an error when the provider returns ?error=', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/notion/callback?error=access_denied');

    await expect(page.getByText('Connection failed')).toBeVisible();
    await expect(page.getByText('access_denied')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible();
  });

  test('shows an error when the authorization code is missing', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/notion/callback');

    await expect(page.getByText('Connection failed')).toBeVisible();
    await expect(page.getByText('Missing authorization code.')).toBeVisible();
  });

  test('"Go back" returns to the home page', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/notion/callback?error=access_denied');

    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page).toHaveURL('http://localhost:3000/');
  });
});
