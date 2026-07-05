import { test, expect } from '@playwright/test';
import { mockBackend, seedAuthToken, TEST_USER } from './helpers/mock-api';

test.describe('Login page', () => {
  test('renders the sign-in form', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('logs in successfully and lands on the chat page', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/login');

    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password').fill('correct-horse');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // After login the router replaces to '/', which loads the chat UI.
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    // Token was persisted to sessionStorage.
    const token = await page.evaluate(() => sessionStorage.getItem('access_token'));
    expect(token).toBeTruthy();
  });

  test('shows an error message on invalid credentials', async ({ page }) => {
    await mockBackend(page);
    // Override the token endpoint to reject.
    await page.route('**/api/auth/token', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Bad creds' }) })
    );

    await page.goto('/login');
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('nope');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The login() wrapper surfaces "API error 401: ..." which is shown in the
    // form's error banner.
    await expect(page.getByText(/API error 401/)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    // Stale token is cleared on failure.
    const token = await page.evaluate(() => sessionStorage.getItem('access_token'));
    expect(token).toBeNull();
  });

  test('toggles password visibility', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/login');

    const pw = page.getByLabel('Password');
    await pw.fill('secret');
    await expect(pw).toHaveAttribute('type', 'password');

    // The eye toggle is the only button inside the password field group.
    await page.locator('input#password ~ button').click();
    await expect(pw).toHaveAttribute('type', 'text');
  });

  test('navigates to the register page', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/login');
    await page.getByRole('link', { name: 'Register' }).click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('empty submit is blocked by HTML validation', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Required field keeps us on the login page.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Email')).toBeFocused();
  });
});

test.describe('Register page', () => {
  test('renders the registration form', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/register');

    await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('registers successfully and redirects to login', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/register');

    await page.getByLabel('Full name').fill('New Person');
    await page.getByLabel('Email').fill('new@example.com');
    await page.getByLabel('Password').fill('hunter2hunter2');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows an error when registration fails', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Email exists' }) })
    );

    await page.goto('/register');
    await page.getByLabel('Email').fill('dupe@example.com');
    await page.getByLabel('Password').fill('whatever123');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText(/API error 400/)).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('navigates back to sign in', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/register');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Auth guard & logout', () => {
  test('unauthenticated visit to / redirects to /login', async ({ page }) => {
    // No token seeded + /api/auth/me returns 401.
    await mockBackend(page, { user: null });
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('authenticated user sees the chat shell and their email', async ({ page }) => {
    await seedAuthToken(page);
    await mockBackend(page);
    await page.goto('/');

    await expect(page.getByText(TEST_USER.email)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('logout returns the user to /login', async ({ page }) => {
    await seedAuthToken(page);
    await mockBackend(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
