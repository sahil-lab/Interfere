import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSkeleton } from './api';

const validStatus = {
  project: 'Interfere',
  phase: 1,
  fixtureId: 'synthetic-demo',
  database: 'ready',
  telemetryEnabled: false,
  patchAutomationEnabled: false,
};

afterEach(() => vi.unstubAllGlobals());

describe('the synthetic API boundary', () => {
  it('sends only the allowlisted fixture on an explicit check', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(validStatus));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchSkeleton(true)).resolves.toEqual(validStatus);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/skeleton/check',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fixtureId: 'synthetic-demo' }),
      }),
    );
  });

  it.each([
    {},
    { ...validStatus, database: 'unavailable' },
    { ...validStatus, telemetryEnabled: true },
  ])(
    'does not turn a malformed or unsafe contract into success',
    async (value) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(value)));
      await expect(fetchSkeleton(false)).rejects.toThrow(
        'unexpected Phase 1 response',
      );
    },
  );

  it('reports an HTTP failure with its request reference but not server internals', async () => {
    const requestId = '93b458d7-8339-4c3b-86a6-120f2c07bc78';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { detail: 'internal-only-synthetic-marker' },
            { status: 503, headers: { 'X-Request-Id': requestId } },
          ),
        ),
    );

    await expect(fetchSkeleton(false)).rejects.toThrow(
      `The local API check failed (HTTP 503). Request ID: ${requestId}.`,
    );
  });

  it('propagates a network failure instead of returning a fake fixture', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Network unavailable')),
    );
    await expect(fetchSkeleton(false)).rejects.toThrow('Network unavailable');
  });
});
