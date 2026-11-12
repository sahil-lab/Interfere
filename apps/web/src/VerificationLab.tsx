import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { fetchSkeleton, type SkeletonStatus } from './api';

type CheckState =
  | { kind: 'loading' | 'checking' }
  | { kind: 'ready' | 'verified'; data: SkeletonStatus; durationMs: number }
  | { kind: 'error'; message: string; durationMs: number };

interface LedgerEntry {
  id: number;
  method: 'GET' | 'POST';
  time: string;
  durationMs: number;
  outcome: 'verified' | 'failed';
  detail: string;
}

const views = [
  { id: 'response', label: 'Response' },
  { id: 'ledger', label: 'Session ledger' },
  { id: 'guards', label: 'Input guards' },
  { id: 'stack', label: 'Local stack' },
] as const;
type View = (typeof views)[number]['id'];

const vectors = [
  {
    label: 'The expected fixture',
    payload: '{"fixtureId":"synthetic-demo"}',
    contentType: 'application/json',
    status: 200,
    explanation:
      'The allowlisted fixture passes validation and is read from PostgreSQL.',
  },
  {
    label: 'An unknown fixture',
    payload: '{"fixtureId":"not-allowed-synthetic-marker"}',
    contentType: 'application/json',
    status: 400,
    explanation:
      'A non-allowlisted value is rejected before the database check.',
  },
  {
    label: 'An unexpected field',
    payload: '{"fixtureId":"synthetic-demo","extra":"synthetic-marker"}',
    contentType: 'application/json',
    status: 400,
    explanation: 'Strict JSON deserialization rejects undeclared properties.',
  },
  {
    label: 'The wrong media type',
    payload: 'synthetic-demo',
    contentType: 'text/plain',
    status: 415,
    explanation: 'The endpoint accepts application/json, not a plaintext body.',
  },
] as const;

export default function VerificationLab() {
  const [state, setState] = useState<CheckState>({ kind: 'loading' });
  const [view, setView] = useState<View>('response');
  const [vector, setVector] = useState<(typeof vectors)[number]>(vectors[0]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const entrySequence = useRef(0);

  const observe = useCallback(async (verify: boolean, signal: AbortSignal) => {
    const id = ++entrySequence.current;
    const started = performance.now();
    setState({ kind: verify ? 'checking' : 'loading' });
    try {
      const data = await fetchSkeleton(verify, signal);
      if (signal.aborted) return;
      const durationMs = Math.round(performance.now() - started);
      setState({ kind: verify ? 'verified' : 'ready', data, durationMs });
      setVerifiedCount((count) => count + 1);
      setLedger((entries) => [
        {
          id,
          method: verify ? 'POST' : 'GET',
          time: new Date().toISOString(),
          durationMs,
          outcome: 'verified',
          detail: 'The synthetic-demo fixture was read from PostgreSQL.',
        },
        ...entries.slice(0, 7),
      ]);
    } catch (error: unknown) {
      if (signal.aborted) return;
      const durationMs = Math.round(performance.now() - started);
      const message =
        error instanceof Error ? error.message : 'The local check failed.';
      setState({ kind: 'error', message, durationMs });
      setLedger((entries) => [
        {
          id,
          method: verify ? 'POST' : 'GET',
          time: new Date().toISOString(),
          durationMs,
          outcome: 'failed',
          detail: message,
        },
        ...entries.slice(0, 7),
      ]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    void observe(false, controller.signal);
    return () => controllerRef.current?.abort();
  }, [observe]);

  function check() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    void observe(true, controller.signal);
  }

  function navigateTabs(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % views.length;
    else if (event.key === 'ArrowLeft')
      next = (index + views.length - 1) % views.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = views.length - 1;
    else return;
    event.preventDefault();
    const target = views[next];
    if (target) {
      setView(target.id);
      event.currentTarget.parentElement
        ?.querySelector<HTMLButtonElement>(`#tab-${target.id}`)
        ?.focus();
    }
  }

  const busy = state.kind === 'loading' || state.kind === 'checking';
  const data = 'data' in state ? state.data : null;
  const duration = 'durationMs' in state ? state.durationMs : null;

  return (
    <section
      className="proof-section"
      id="proof-lab"
      aria-labelledby="proof-title"
    >
      <div className="page-width">
        <div className="section-topline mono">
          <span>02 / THE PROOF LAB</span>
          <span>
            <span className="square-mark" /> LOCAL-ONLY / SYNTHETIC DATA
          </span>
        </div>
        <div className="proof-heading">
          <h2 id="proof-title">
            Real request.
            <br />
            <span>Real response.</span>
          </h2>
          <div className="proof-description">
            <p>
              Not a recording. Not a mock dashboard. Send a validated request
              through the web, API, and database. See exactly what comes back.
            </p>
            <span className="mono">
              READ-ONLY / SYNTHETIC FIXTURE / NO TELEMETRY
            </span>
          </div>
        </div>

        <div className="proof-console">
          <div className="console-titlebar mono">
            <span>
              <span className="console-dot" /> INTERFERE / LOCAL SESSION
            </span>
            <span>PHASE 01</span>
          </div>
          <div className="console-layout">
            <div className="request-panel">
              <div className="request-heading">
                <span className="mono">THE VERIFICATION PATH</span>
                <span
                  className={`connection-label ${data ? 'is-ready' : state.kind === 'error' ? 'is-error' : ''}`}
                >
                  <span className="connection-dot" />
                  {data
                    ? 'DATABASE VERIFIED'
                    : busy
                      ? 'CHECKING'
                      : 'UNAVAILABLE'}
                </span>
              </div>
              <ol className="request-path" aria-label="Request path">
                <li>
                  <span className="path-symbol mono">01</span>
                  <div>
                    <h3>The interface</h3>
                    <p>React + TypeScript</p>
                  </div>
                  <span className="path-meta mono">WEB</span>
                </li>
                <li>
                  <span className="path-symbol mono">02</span>
                  <div>
                    <h3>The contract</h3>
                    <p>Spring Boot + Java 21</p>
                  </div>
                  <span className="path-meta mono">API</span>
                </li>
                <li>
                  <span className="path-symbol mono">03</span>
                  <div>
                    <h3>The evidence</h3>
                    <p>PostgreSQL + Flyway</p>
                  </div>
                  <span className="path-meta mono">DB</span>
                </li>
              </ol>

              <div className="request-address mono">
                <span>POST</span>
                <code>/api/skeleton/check</code>
              </div>
              <button
                type="button"
                className="button-primary check-button"
                disabled={busy}
                onClick={check}
              >
                {busy ? 'Checking the connection...' : 'Run synthetic check'}
                <span
                  className={busy ? 'loading-mark' : 'check-arrow'}
                  aria-hidden="true"
                >
                  {busy ? '+' : '\u2197'}
                </span>
              </button>

              <div
                className="check-feedback"
                aria-live="polite"
                aria-atomic="true"
              >
                {busy && (
                  <p>
                    Reading the local synthetic fixture. Waiting for evidence.
                  </p>
                )}
                {state.kind === 'ready' && (
                  <p>
                    The database answered. Ready for a validated round trip.
                  </p>
                )}
                {state.kind === 'verified' && (
                  <p className="check-success">
                    Synthetic check passed. Input was validated and the fixture
                    was read from PostgreSQL.
                  </p>
                )}
                {state.kind === 'error' && (
                  <div className="check-error" role="alert">
                    <strong>No proof, no success.</strong>
                    <p>{state.message}</p>
                    <p>Check the local services, then run the check again.</p>
                  </div>
                )}
              </div>
              <dl className="request-metrics">
                <div>
                  <dt className="mono">VERIFIED READS</dt>
                  <dd data-testid="verified-count">
                    {String(verifiedCount).padStart(2, '0')}
                  </dd>
                </div>
                <div>
                  <dt className="mono">BROWSER ROUND TRIP</dt>
                  <dd>
                    {duration === null ? '--' : duration}
                    <small> ms</small>
                  </dd>
                </div>
              </dl>
              <p className="metrics-note">
                This tab only. Latest completed request, not a benchmark.
              </p>
            </div>

            <div className="inspector">
              <div
                className="inspector-tabs"
                role="tablist"
                aria-label="Verification views"
              >
                {views.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    id={`tab-${item.id}`}
                    role="tab"
                    aria-selected={view === item.id}
                    aria-controls={`panel-${item.id}`}
                    tabIndex={view === item.id ? 0 : -1}
                    onClick={() => setView(item.id)}
                    onKeyDown={(event) => navigateTabs(event, index)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div
                id="panel-response"
                role="tabpanel"
                aria-labelledby="tab-response"
                hidden={view !== 'response'}
                tabIndex={0}
                className="inspector-panel response-panel"
              >
                <div className="inspector-caption mono">
                  <span>
                    {data ? 'VERIFIED RESPONSE' : 'AWAITING EVIDENCE'}
                  </span>
                  <span>JSON / V1</span>
                </div>
                {data ? (
                  <pre className="response-code" data-testid="response-json">
                    <code>{JSON.stringify(data, null, 2)}</code>
                  </pre>
                ) : (
                  <div className="response-empty">
                    <span aria-hidden="true">[ &nbsp; ]</span>
                    <h3>No verified response yet.</h3>
                    <p>
                      {busy
                        ? 'The request is in progress.'
                        : 'The latest request failed. No placeholder data is substituted.'}
                    </p>
                  </div>
                )}
                <div className="query-note">
                  <span className="mono">THE READ-ONLY QUERY</span>
                  <code>
                    <span>SELECT</span> fixture_id
                    <br />
                    <span>FROM</span> skeleton_fixtures
                    <br />
                    <span>WHERE</span> fixture_id = ?
                  </code>
                </div>
              </div>

              <div
                id="panel-ledger"
                role="tabpanel"
                aria-labelledby="tab-ledger"
                hidden={view !== 'ledger'}
                tabIndex={0}
                className="inspector-panel"
              >
                <div className="inspector-caption mono">
                  <span>COMPLETED REQUESTS</span>
                  <span>LAST {ledger.length} / MAX 8</span>
                </div>
                <p className="inspector-description">
                  Only observed results. Reset when you leave this page.
                </p>
                {ledger.length === 0 && (
                  <p className="ledger-empty">No completed requests yet.</p>
                )}
                <ol className="session-ledger" aria-label="Recent check ledger">
                  {ledger.map((entry) => (
                    <li key={entry.id}>
                      <div className="ledger-line mono">
                        <span className={`ledger-outcome ${entry.outcome}`}>
                          {entry.outcome}
                        </span>
                        <span>{entry.method}</span>
                        <time dateTime={entry.time}>
                          {entry.time.slice(11, 19)} UTC
                        </time>
                        <span>{entry.durationMs} ms</span>
                      </div>
                      <p>{entry.detail}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div
                id="panel-guards"
                role="tabpanel"
                aria-labelledby="tab-guards"
                hidden={view !== 'guards'}
                tabIndex={0}
                className="inspector-panel"
              >
                <div className="inspector-caption mono">
                  <span>CONTRACT EXAMPLES</span>
                  <span>NOT EXECUTED HERE</span>
                </div>
                <div className="guard-choices" aria-label="Validation examples">
                  {vectors.map((item, index) => (
                    <button
                      type="button"
                      key={item.label}
                      aria-pressed={vector === item}
                      onClick={() => setVector(item)}
                    >
                      <span className="mono">0{index + 1}</span>
                      {item.label}
                      <span aria-hidden="true">&#8599;</span>
                    </button>
                  ))}
                </div>
                <div className="guard-detail">
                  <div className="guard-status mono">
                    <span>EXPECTED HTTP {vector.status}</span>
                    <span>{vector.contentType}</span>
                  </div>
                  <pre>
                    <code>{vector.payload}</code>
                  </pre>
                  <p>{vector.explanation}</p>
                  <p className="guard-footnote">
                    Rejected values are not echoed in the API's problem details.
                  </p>
                </div>
              </div>

              <div
                id="panel-stack"
                role="tabpanel"
                aria-labelledby="tab-stack"
                hidden={view !== 'stack'}
                tabIndex={0}
                className="inspector-panel"
              >
                <div className="inspector-caption mono">
                  <span>LOCAL CONFIGURATION</span>
                  <span>NOT LIVE METRICS</span>
                </div>
                <p className="inspector-description">
                  Declared Compose settings, not a Docker inspection feed.
                </p>
                <dl className="stack-spec">
                  <div>
                    <dt>
                      Web <span className="mono">18106</span>
                    </dt>
                    <dd>64 MiB / 0.25 CPU</dd>
                  </div>
                  <div>
                    <dt>
                      API <span className="mono">18206</span>
                    </dt>
                    <dd>512 MiB / 0.75 CPU</dd>
                  </div>
                  <div>
                    <dt>
                      Database <span className="mono">INTERNAL</span>
                    </dt>
                    <dd>256 MiB / 0.50 CPU</dd>
                  </div>
                  <div>
                    <dt>Host binding</dt>
                    <dd>
                      <code>127.0.0.1</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Database host port</dt>
                    <dd>Not published</dd>
                  </div>
                  <div>
                    <dt>Runtime filesystems</dt>
                    <dd>Read-only</dd>
                  </div>
                </dl>
                <p className="stack-note">
                  Compose project: <code>interfere</code>. No external
                  application service is required.
                </p>
              </div>
            </div>
          </div>
          <div className="console-bottom mono">
            <span>
              <span aria-hidden="true">&#8627;</span> THE DATA IS SYNTHETIC. THE
              CONNECTION IS REAL.
            </span>
            <a href="/openapi.yaml">
              OPENAPI CONTRACT <span aria-hidden="true">&#8599;</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
