export interface SkeletonStatus {
  project: 'Interfere';
  phase: 1;
  fixtureId: 'synthetic-demo';
  database: 'ready';
  telemetryEnabled: false;
  patchAutomationEnabled: false;
}

function isSkeletonStatus(value: unknown): value is SkeletonStatus {
  return (
    typeof value === 'object' &&
    value !== null &&
    'project' in value &&
    value.project === 'Interfere' &&
    'phase' in value &&
    value.phase === 1 &&
    'fixtureId' in value &&
    value.fixtureId === 'synthetic-demo' &&
    'database' in value &&
    value.database === 'ready' &&
    'telemetryEnabled' in value &&
    value.telemetryEnabled === false &&
    'patchAutomationEnabled' in value &&
    value.patchAutomationEnabled === false
  );
}

export async function fetchSkeleton(
  verify: boolean,
  signal?: AbortSignal,
): Promise<SkeletonStatus> {
  const timeout = AbortSignal.timeout(10000);
  const response = await fetch(
    verify ? '/api/skeleton/check' : '/api/skeleton/status',
    {
      ...(verify
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fixtureId: 'synthetic-demo' }),
          }
        : { method: 'GET' }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    },
  );

  if (!response.ok) {
    const requestId = response.headers.get('X-Request-Id');
    const reference =
      requestId && /^[a-f0-9-]{36}$/i.test(requestId)
        ? ` Request ID: ${requestId}.`
        : '';
    throw new Error(
      `The local API check failed (HTTP ${response.status}).${reference}`,
    );
  }

  const value: unknown = await response.json();
  if (!isSkeletonStatus(value)) {
    throw new Error('The local API returned an unexpected Phase 1 response.');
  }
  return value;
}
