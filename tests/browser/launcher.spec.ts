import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

test('the launcher URL loads styled ASCII and supports location selection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).margin)).toBe('0px');
  expect(await page.evaluate(() => document.fonts.check('500 21px "IBM Plex Mono"'))).toBe(true);
  await page.locator('#intro-destinations').click();
  await page.locator('[data-destination="movie-theater"]').click();
  await expect(page.locator('#world')).toBeFocused();
  expect(await page.evaluate(() => (window as any).__asciiWalk.ready)).toBe(true);
  expect(await page.evaluate(() => (window as any).__asciiWalk.stats().drawCalls)).toBeGreaterThan(0);
  await page.keyboard.press('c');
  await expect(page.locator('#color-toggle')).toContainText('Mono');
  expect(errors).toEqual([]);
});

test('opening the HTML file directly explains how to launch the app', async ({ page }) => {
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await expect(page.getByRole('heading', { name: 'Start ASCII Walk with the launcher' })).toBeVisible();
  await expect(page.getByText('Launch ASCII Walk.cmd', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'open ASCII Walk here' })).toHaveAttribute(
    'href',
    'http://127.0.0.1:5173/',
  );
});
