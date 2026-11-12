import { expect, test } from '@playwright/test';

const success =
  'Synthetic check passed. Input was validated and the fixture was read from PostgreSQL.';

test('the editorial page reaches real PostgreSQL and its inspector is keyboard navigable', async ({
  page,
  baseURL,
}) => {
  const pageErrors = [];
  const origins = new Set();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  page.on('request', (request) => origins.add(new URL(request.url()).origin));

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Less noise. More proof.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Enter the proof lab' }).click();
  await expect(
    page.getByText('DATABASE VERIFIED', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('verified-count')).toHaveText('01');

  const button = page.getByRole('button', { name: 'Run synthetic check' });
  await button.focus();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/skeleton/check') &&
      response.request().method() === 'POST',
  );
  await page.keyboard.press('Enter');
  const response = await responsePromise;

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toEqual({
    project: 'Interfere',
    phase: 1,
    fixtureId: 'synthetic-demo',
    database: 'ready',
    telemetryEnabled: false,
    patchAutomationEnabled: false,
  });
  await expect(page.getByText(success, { exact: true })).toBeVisible();
  await expect(page.getByTestId('verified-count')).toHaveText('02');
  expect(
    JSON.parse(await page.getByTestId('response-json').innerText()),
  ).toEqual(body);

  await page.getByRole('tab', { name: 'Response', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Session ledger' })).toBeFocused();
  await expect(
    page.getByRole('tab', { name: 'Session ledger' }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    page
      .getByRole('list', { name: 'Recent check ledger' })
      .getByRole('listitem'),
  ).toHaveCount(2);

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Input guards' })).toBeFocused();
  await page.getByRole('button', { name: /An unknown fixture/ }).click();
  await expect(
    page.getByText('EXPECTED HTTP 400', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('NOT EXECUTED HERE', { exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Input guards' }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Local stack' })).toBeFocused();
  await expect(
    page.getByText('NOT LIVE METRICS', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('response-json')).toBeVisible();

  await page.locator('summary').filter({ hasText: 'What comes next' }).click();
  await expect(
    page.getByRole('heading', { name: 'The repair engine comes later' }),
  ).toBeVisible();
  expect(origins).toEqual(new Set([new URL(baseURL).origin]));
  expect(pageErrors).toEqual([]);
});

test('mobile UI exposes failures without false success and recovers on a real retry', async ({
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
  await expect(page.getByTestId('verified-count')).toHaveText('01');
  await page.getByRole('button', { name: 'Run synthetic check' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await expect(page.getByRole('alert')).not.toContainText(
    'internal-only-synthetic-marker',
  );
  await expect(page.getByText(success, { exact: true })).not.toBeVisible();
  await expect(page.getByTestId('response-json')).not.toBeVisible();
  await expect(page.getByTestId('verified-count')).toHaveText('01');
  await expect(
    page.getByRole('heading', { name: 'No verified response yet.' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Input guards' }).click();
  await page.getByRole('button', { name: /An unexpected field/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.unroute('**/api/skeleton/check');
  await page.getByRole('button', { name: 'Run synthetic check' }).click();
  await expect(page.getByText(success, { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).not.toBeVisible();
  await expect(page.getByTestId('verified-count')).toHaveText('02');
});

test('an initial API failure never creates a verified read or fabricated response', async ({
  page,
}) => {
  await page.route('**/api/skeleton/status', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('verified-count')).toHaveText('00');
  await expect(page.getByTestId('response-json')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Session ledger' }).click();
  const ledger = page.getByRole('list', { name: 'Recent check ledger' });
  await expect(ledger.getByRole('listitem')).toHaveCount(1);
  await expect(ledger).toContainText('failed');
  await page.getByRole('button', { name: 'Run synthetic check' }).click();
  await expect(page.getByTestId('verified-count')).toHaveText('01');
  await expect(page.getByText(success, { exact: true })).toBeVisible();
});

test('the signal artwork respects reduced motion and can be tuned with the keyboard', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mutations = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') mutations.push(request.url());
  });
  await page.goto('/');
  const canvas = page.getByRole('img', { name: /woven signal loop/ });
  await expect(canvas).toHaveAttribute('data-motion', 'paused');
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const initial = await canvas.evaluate((element) => element.toDataURL());
  await page.waitForTimeout(200);
  expect(
    (await canvas.evaluate((element) => element.toDataURL())) === initial,
  ).toBe(true);

  const slider = page.getByRole('slider', { name: 'Sculpture interference' });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('100');
  expect(
    (await canvas.evaluate((element) => element.toDataURL())) === initial,
  ).toBe(false);
  await expect(
    page.getByRole('button', { name: 'Resume sculpture motion' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Resume sculpture motion' }).click();
  const running = await canvas.evaluate((element) => element.toDataURL());
  await expect
    .poll(
      async () =>
        (await canvas.evaluate((element) => element.toDataURL())) !== running,
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Pause sculpture motion' }).click();
  const paused = await canvas.evaluate((element) => element.toDataURL());
  await page.waitForTimeout(200);
  expect(
    (await canvas.evaluate((element) => element.toDataURL())) === paused,
  ).toBe(true);
  expect(mutations).toEqual([]);
});

test('the page fits mobile, tablet, and wide desktop without clipping its main content', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready.then(() => true));
  for (const width of [360, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Page should not overflow at ${width}px`,
    ).toBe(true);
    const heading = await page
      .getByRole('heading', { name: 'Less noise. More proof.' })
      .boundingBox();
    expect(heading.x).toBeGreaterThanOrEqual(0);
    expect(heading.x + heading.width).toBeLessThanOrEqual(width);
  }
});
