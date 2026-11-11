import { expect, test } from '@playwright/test';

const success =
  'Synthetic check passed. Input was validated and the fixture was read from PostgreSQL.';

test('keyboard-activated browser check reaches real PostgreSQL without external requests', async ({
  page,
  baseURL,
}) => {
  const pageErrors = [];
  const origins = new Set();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => origins.add(new URL(request.url()).origin));

  await page.goto('/');
  await expect(
    page.getByText('DATABASE VERIFIED', { exact: true }),
  ).toBeVisible();
  const button = page.getByRole('button', { name: 'Run synthetic check' });
  await button.focus();
  await expect(button).toBeFocused();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/skeleton/check') &&
      response.request().method() === 'POST',
  );
  await page.keyboard.press('Enter');
  const response = await responsePromise;

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    project: 'Interfere',
    phase: 1,
    fixtureId: 'synthetic-demo',
    database: 'ready',
    telemetryEnabled: false,
    patchAutomationEnabled: false,
  });
  await expect(page.getByText(success, { exact: true })).toBeVisible();
  await expect(
    page.getByText('The repair engine comes later', { exact: true }),
  ).toBeVisible();
  expect(origins).toEqual(new Set([new URL(baseURL).origin]));
  expect(pageErrors).toEqual([]);
});

test('mobile dashboard surfaces an injected API failure and recovers on a real retry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/skeleton/check', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      headers: { 'X-Request-Id': '93b458d7-8339-4c3b-86a6-120f2c07bc78' },
      body: JSON.stringify({
        status: 503,
        detail: 'internal-only-synthetic-marker',
      }),
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Run synthetic check' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await expect(page.getByRole('alert')).not.toContainText(
    'internal-only-synthetic-marker',
  );
  await expect(page.getByText(success, { exact: true })).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.unroute('**/api/skeleton/check');
  await page.getByRole('button', { name: 'Run synthetic check' }).click();
  await expect(page.getByText(success, { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).not.toBeVisible();
});
