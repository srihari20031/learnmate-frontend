import { test, expect } from '@playwright/test';
import { mockBackend, seedAuthToken } from './helpers/mock-api';

/**
 * Runs only under the `mobile` project (Pixel 7 viewport, < 768px), where the
 * sidebar becomes a fixed overlay with a backdrop instead of an inline panel.
 */
test.describe('Mobile sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthToken(page);
    await mockBackend(page);
  });

  test('sidebar is hidden by default on a phone viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'New Chat', exact: true })).not.toBeVisible();
  });

  test('opening the sidebar reveals the overlay dialog', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open sidebar' }).click();

    await expect(page.getByRole('dialog', { name: 'Navigation sidebar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Chat', exact: true })).toBeVisible();
  });

  test('pressing Escape closes the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open sidebar' }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation sidebar' })).toBeVisible();

    // The mobile sidebar is a focus-trapped dialog; Escape dismisses it.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Navigation sidebar' })).not.toBeVisible();
  });

  test('tapping the backdrop closes the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open sidebar' }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation sidebar' })).toBeVisible();

    // Two stacked full-screen backdrops render on mobile; the sidebar's own
    // backdrop sits on top and is the one that receives the click. The 260px
    // panel sits on the left, so click well to its right.
    await page.locator('div.fixed.inset-0.z-40').last().click({ position: { x: 380, y: 400 } });
    await expect(page.getByRole('dialog', { name: 'Navigation sidebar' })).not.toBeVisible();
  });
});
