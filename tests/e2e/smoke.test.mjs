import assert from 'node:assert/strict';
import { test } from 'node:test';

const web = process.env.WEB_BASE_URL;
const api = process.env.API_BASE_URL;
assert.ok(web && api, 'WEB_BASE_URL and API_BASE_URL must be explicit.');

const expected = {
  project: 'Interfere',
  phase: 1,
  fixtureId: 'synthetic-demo',
  database: 'ready',
  telemetryEnabled: false,
  patchAutomationEnabled: false,
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function request(base, path, options = {}) {
  return fetch(new URL(path, base), {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
}

test('web serves the production entry, built assets, and security headers', async () => {
  const response = await request(web, '/');
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('content-security-policy'),
    /connect-src 'self'/,
  );
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const html = await response.text();
  assert.match(html, /Interfere \| Local engineering skeleton/);
  const script = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert.ok(script, 'The HTML must reference a production JS bundle.');
  const asset = await request(web, script);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  const health = await request(web, '/healthz');
  assert.equal(health.status, 200);
  assert.equal(await health.text(), 'ok\n');
});

test('liveness and database-backed readiness are UP without exposed details', async () => {
  for (const name of ['liveness', 'readiness']) {
    const response = await request(api, `/actuator/health/${name}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'UP' });
  }
});

test('web proxy and direct API return the exact real database contract', async () => {
  for (const base of [web, api]) {
    const response = await request(base, '/api/skeleton/status');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('x-request-id'), uuid);
    assert.deepEqual(await response.json(), expected);
  }
});

test('validated synthetic round trips are repeatable and server-correlated', async () => {
  const requestIds = new Set();
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request(web, '/api/skeleton/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'untrusted-synthetic-marker',
      },
      body: JSON.stringify({ fixtureId: 'synthetic-demo' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
    const requestId = response.headers.get('x-request-id');
    assert.match(requestId, uuid);
    requestIds.add(requestId);
  }
  assert.equal(requestIds.size, 2);
});

test('invalid input is rejected without echoing user-controlled values', async () => {
  const bodies = [
    '{}',
    '{"fixtureId":null}',
    '{"fixtureId":""}',
    '{"fixtureId":"not-allowed-synthetic-marker"}',
    '{"fixtureId":"synthetic-demo","extra":"not-allowed-synthetic-marker"}',
    '{',
    '[]',
  ];
  for (const body of bodies) {
    const response = await request(web, '/api/skeleton/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    assert.equal(
      response.status,
      400,
      `Unexpected status for synthetic input: ${body}`,
    );
    assert.match(
      response.headers.get('content-type'),
      /application\/problem\+json/,
    );
    const raw = await response.text();
    assert.ok(!raw.includes('not-allowed-synthetic-marker'));
    const problem = JSON.parse(raw);
    assert.equal(problem.status, 400);
    assert.match(problem.requestId, uuid);
    assert.equal(problem.requestId, response.headers.get('x-request-id'));
    assert.equal(
      problem.instance,
      `urn:interfere:request:${problem.requestId}`,
    );
  }
});

test('wrong content types and methods produce explicit client failures', async () => {
  const wrongType = await request(web, '/api/skeleton/check', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'synthetic-demo',
  });
  assert.equal(wrongType.status, 415);
  assert.equal((await wrongType.json()).status, 415);
  const wrongMethod = await request(web, '/api/skeleton/check');
  assert.equal(wrongMethod.status, 405);
  assert.equal((await wrongMethod.json()).status, 405);
});

test('the published contract is real and future domain routes remain absent', async () => {
  const response = await request(web, '/openapi.yaml');
  assert.equal(response.status, 200);
  const contract = await response.text();
  assert.match(contract, /openapi: 3\.0\.3/);
  assert.match(contract, /\/api\/skeleton\/check:/);
  for (const [method, path] of [
    ['GET', '/incidents'],
    ['POST', '/telemetry'],
    ['POST', '/incidents/synthetic-demo/reproduce'],
    ['POST', '/incidents/synthetic-demo/propose-fix'],
  ]) {
    const future = await request(api, path, { method });
    assert.equal(future.status, 404);
  }
});
