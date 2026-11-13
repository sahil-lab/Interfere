import { expect, test } from '@playwright/test';

const success =
  'Synthetic check passed. Input was validated and the fixture was read from PostgreSQL.';

function watch(page) {
  const problems = [];
  const origins = new Set();
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('request', (request) => origins.add(new URL(request.url()).origin));
  return { problems, origins };
}

function frameCounter(field) {
  const read = async () => Number(await field.getAttribute('data-frames'));
  const drawnDuring = async (page, ms = 350) => {
    const before = await read();
    await page.waitForTimeout(ms);
    return (await read()) - before;
  };
  return { read, drawnDuring };
}

const fitsViewport = (page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

/** The colour that reached the screen at a viewport point, as RGBA. */
async function shownAt(page, point) {
  const capture = await page.screenshot({
    clip: { x: point.x, y: point.y, width: 1, height: 1 },
  });
  // Decoded on a blank page: the app's own policy rightly blocks data: images.
  const blank = await page.context().newPage();
  try {
    return await blank.evaluate(async (encoded) => {
      const image = new Image();
      image.src = `data:image/png;base64,${encoded}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    }, capture.toString('base64'));
  } finally {
    await blank.close();
  }
}

test('the page reaches real PostgreSQL and its inspector is keyboard navigable', async ({
  page,
  baseURL,
}) => {
  const { problems, origins } = watch(page);

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
  await expect(
    page.getByText('Last check verified', { exact: true }),
  ).toBeVisible();
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
  expect(problems).toEqual([]);
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
    page.getByText('Last check failed', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No verified response yet.' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Input guards' }).click();
  await page.getByRole('button', { name: /An unexpected field/ }).click();
  expect(await fitsViewport(page)).toBe(true);

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

test('the WebGL field draws lit points, follows the chapters, and stops when paused', async ({
  page,
}) => {
  const { problems } = watch(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const field = page.getByTestId('field');
  const frames = frameCounter(field);
  await expect(field).toHaveAttribute('data-renderer', 'running');
  await expect(field).toHaveAttribute('data-motion', 'running');
  await expect.poll(() => frames.drawnDuring(page)).toBeGreaterThan(1);

  // The field assembles once the opening curtain has lifted. Read the canvas
  // inside the frame it was drawn in: a blank field has no pixel anywhere
  // near this bright.
  await expect(page.locator('.intro')).toHaveCount(0);
  const litPixels = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            const source = document.querySelector(
              '[data-testid="field"] canvas',
            );
            const probe = document.createElement('canvas');
            probe.width = source.width;
            probe.height = source.height;
            const context = probe.getContext('2d');
            context.drawImage(source, 0, 0);
            const { data } = context.getImageData(
              0,
              0,
              probe.width,
              probe.height,
            );
            let count = 0;
            for (let index = 0; index < data.length; index += 4) {
              if (data[index] > 110) count += 1;
            }
            resolve(count);
          });
        }),
    );
  await expect.poll(litPixels).toBeGreaterThan(600);

  await expect(field).toHaveAttribute('data-formation', '0');
  await page.locator('#principle').evaluate((node) => node.scrollIntoView());
  await expect(field).toHaveAttribute('data-formation', '1');
  for (const formation of ['2', '3']) {
    await page
      .locator(`[data-field-anchor="${formation}"]`)
      .evaluate((node) => node.scrollIntoView({ block: 'center' }));
    await expect(field).toHaveAttribute('data-formation', formation);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(field).toHaveAttribute('data-formation', '0');
  await page.getByRole('button', { name: 'Pause field motion' }).click();
  await expect(field).toHaveAttribute('data-motion', 'paused');
  await expect.poll(() => frames.drawnDuring(page)).toBe(0);
  await page.getByRole('button', { name: 'Resume field motion' }).click();
  await expect(field).toHaveAttribute('data-motion', 'running');
  await expect.poll(() => frames.drawnDuring(page)).toBeGreaterThan(1);
  expect(problems).toEqual([]);
});

test('scrolling scrubs the statement and drives the pinned steps sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.intro')).toHaveCount(0);

  const lastWord = page.locator('.statement .word').last();
  const opacity = () =>
    lastWord.evaluate((node) => Number(getComputedStyle(node).opacity));
  const scrollToEndOf = (selector) =>
    page.locator(selector).evaluate((node) => {
      const top = node.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + node.offsetHeight - window.innerHeight);
    });

  await page.locator('#principle').evaluate((node) => node.scrollIntoView());
  await expect.poll(opacity).toBeLessThan(0.5);
  await scrollToEndOf('.statement');
  await expect.poll(opacity).toBe(1);

  const third = page.getByRole('heading', { name: 'Show the proof.' });
  const left = async () => (await third.boundingBox()).x;
  await page.locator('.steps').evaluate((node) => node.scrollIntoView());
  await expect.poll(left).toBeGreaterThan(1440);
  await scrollToEndOf('.steps');
  await expect.poll(left).toBeLessThan(1100);
  expect(await left()).toBeGreaterThan(0);
  expect(await fitsViewport(page)).toBe(true);
});

test('the mouse wheel glides to exactly where native scrolling would land', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.intro')).toHaveCount(0);
  const scrollY = () => page.evaluate(() => Math.round(window.scrollY));

  await page.mouse.move(400, 500);
  await page.mouse.wheel(0, 700);
  await page.mouse.wheel(0, 500);
  await expect.poll(scrollY).toBe(1200);
  await page.mouse.wheel(0, -5000);
  await expect.poll(scrollY).toBe(0);
});

test('a key pressed after a wheel glide scrolls the page natively', async ({
  page,
}) => {
  // The artwork is off here on purpose. While the field is drawing, this
  // software-rendered browser ignores End roughly one press in six, with or
  // without any wheel input (see the execution record), so the default page
  // cannot show whether the wheel code leaves the keyboard alone.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?field=off');
  await expect(page.locator('.intro')).toHaveCount(0);
  const scrollY = () => page.evaluate(() => Math.round(window.scrollY));

  await page.mouse.move(400, 500);
  await page.mouse.wheel(0, 700);
  await expect.poll(scrollY).toBe(700);
  await page.keyboard.press('End');
  const bottom = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  await expect.poll(scrollY).toBe(Math.round(bottom));
});

test('a chapter link pressed while the wheel is still gliding goes to its chapter', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.intro')).toHaveCount(0);
  await page.evaluate(() =>
    window.scrollTo({ top: 2600, behavior: 'instant' }),
  );
  await expect(page.locator('.rail')).not.toHaveClass(/is-hidden/);
  const box = await page.locator('.rail a[href="#boundaries"]').boundingBox();
  expect(box).not.toBeNull();

  // Pressed straight after the wheel, while the glide has barely begun. The
  // glide's next step used to cancel the scroll that the link starts.
  await page.mouse.move(400, 500);
  await page.mouse.wheel(0, 500);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect
    .poll(() =>
      page
        .locator('#boundaries')
        .evaluate((node) => Math.abs(node.getBoundingClientRect().top) <= 1),
    )
    .toBe(true);
});

test('the dark page is painted in every chapter and above the footer', async ({
  page,
}) => {
  // The field's canvas is the page background, so a canvas that fails to
  // reach the screen leaves an unpainted hole rather than a dark page. This
  // walks the page and checks what is actually on screen.
  // It is a general guard only. The hole recorded in D009 needed solid
  // covers, forced full detail, and the whole walk down the page, which
  // takes minutes in this software-rendered browser; this quicker route at
  // the default detail passed with solid covers too.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.intro')).toHaveCount(0);
  const field = page.getByTestId('field');
  await expect(field).toHaveAttribute('data-renderer', 'running');

  const painted = async (point) => {
    const [red, green, blue, alpha] = await shownAt(page, point);
    return (
      alpha === 255 &&
      red + green + blue >= 8 &&
      Math.max(red, green, blue) < 90
    );
  };
  // x = 6 is in the page gutter. Find a row there that no full-width band
  // crosses, so that the field is the only thing painted at the point.
  const clearRow = () =>
    page.evaluate(() => {
      for (let y = 200; y <= 700; y += 30) {
        const crossed = document
          .elementsFromPoint(6, y)
          .some((node) => node.closest('.marquee, .site-footer, .site-header'));
        if (!crossed) return y;
      }
      return -1;
    });
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  for (const share of [0, 0.2, 0.4, 0.6, 0.8]) {
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: 'instant' }),
      Math.round(height * share),
    );
    const y = await clearRow();
    expect(y).toBeGreaterThan(0);
    await expect
      .poll(() => painted({ x: 6, y }), {
        message: `Page background at ${share * 100}% of the page`,
      })
      .toBe(true);
  }

  await page.evaluate(
    (top) => window.scrollTo({ top, behavior: 'instant' }),
    height,
  );
  await expect(field).toHaveAttribute('data-formation', '3');
  const footerTop = await page
    .locator('.site-footer')
    .evaluate((node) => node.getBoundingClientRect().top);
  expect(footerTop).toBeGreaterThan(200);
  expect(footerTop).toBeLessThan(700);
  for (const y of [40, footerTop / 2, footerTop - 30]) {
    await expect
      .poll(() => painted({ x: 6, y: Math.round(y) }), {
        message: `Page background ${Math.round(y)}px down, above the footer`,
      })
      .toBe(true);
  }
});

test('the page and the proof console work with the artwork switched off', async ({
  page,
}) => {
  const { problems } = watch(page);
  await page.goto('/?field=off');

  const field = page.getByTestId('field');
  await expect(field).toHaveAttribute('data-renderer', 'unavailable');
  await expect(page.getByRole('status')).toContainText(
    'Interactive artwork is unavailable or switched off.',
  );
  await expect(
    page.getByRole('slider', { name: 'Field noise' }),
  ).toBeDisabled();
  await expect(page.locator('.intro')).toHaveCount(0);

  await page.getByRole('button', { name: 'Run synthetic check' }).click();
  await expect(page.getByText(success, { exact: true })).toBeVisible();
  await expect(page.getByTestId('verified-count')).toHaveText('02');
  expect(await field.getAttribute('data-frames')).toBeNull();
  expect(problems).toEqual([]);
});

test('reduced motion gets a static field, no intro, and unpinned chapters', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mutations = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') mutations.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.locator('.intro')).toHaveCount(0);
  const field = page.getByTestId('field');
  const frames = frameCounter(field);
  await expect(field).toHaveAttribute('data-renderer', 'running');
  await expect(field).toHaveAttribute('data-motion', 'paused');
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await expect.poll(() => frames.drawnDuring(page)).toBe(0);

  // The slider redraws once on demand, then the field is still again.
  const before = await frames.read();
  const slider = page.getByRole('slider', { name: 'Field noise' });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('100');
  await expect.poll(frames.read).toBeGreaterThan(before);
  await expect.poll(() => frames.drawnDuring(page)).toBe(0);

  expect(
    await page
      .locator('.statement-pin')
      .evaluate((node) => getComputedStyle(node).position),
  ).toBe('static');
  expect(
    await page
      .locator('.statement .word')
      .evaluateAll((nodes) =>
        nodes.every((node) => Number(getComputedStyle(node).opacity) === 1),
      ),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Resume field motion' }),
  ).toBeVisible();
  expect(await fitsViewport(page)).toBe(true);
  expect(mutations).toEqual([]);
});

test('the page fits mobile, tablet, and wide desktop without clipping its headline', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.intro')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  // Let the headline's reveal finish so its glyphs are measured at rest.
  await page.waitForTimeout(1600);

  for (const width of [360, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await fitsViewport(page),
      `Page should not overflow at ${width}px`,
    ).toBe(true);
    const extents = await page
      .locator('.hero h1 .line-inner')
      .evaluateAll((lines) =>
        lines.map((line) => {
          const range = document.createRange();
          range.selectNodeContents(line);
          const box = range.getBoundingClientRect();
          return [box.left, box.right];
        }),
      );
    expect(extents).toHaveLength(2);
    for (const [start, end] of extents) {
      expect(start, `Headline starts on screen at ${width}px`).toBeGreaterThan(
        -2,
      );
      expect(end, `Headline ends on screen at ${width}px`).toBeLessThan(
        width + 2,
      );
    }
  }
});
