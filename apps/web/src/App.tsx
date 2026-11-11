import { useEffect, useState } from 'react';
import { fetchSkeleton, type SkeletonStatus } from './api';

type CheckState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: SkeletonStatus }
  | { kind: 'checking' }
  | { kind: 'verified'; data: SkeletonStatus }
  | { kind: 'error'; message: string };

export default function App() {
  const [state, setState] = useState<CheckState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    void fetchSkeleton(false, controller.signal).then(
      (data) => setState({ kind: 'ready', data }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            kind: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The API is unavailable.',
          });
        }
      },
    );
    return () => controller.abort();
  }, []);

  async function check() {
    setState({ kind: 'checking' });
    try {
      const data = await fetchSkeleton(true);
      setState({ kind: 'verified', data });
    } catch (error: unknown) {
      setState({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'The API is unavailable.',
      });
    }
  }

  const pending = state.kind === 'loading' || state.kind === 'checking';
  const data =
    state.kind === 'ready' || state.kind === 'verified'
      ? state.data
      : undefined;

  return (
    <div className="shell">
      <header className="masthead">
        <a className="brand" href="/" aria-label="Interfere home">
          <span className="brand-mark" aria-hidden="true">
            i
          </span>
          Interfere
        </a>
        <span className="environment">LOCAL / SYNTHETIC ONLY</span>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">
            VERIFIED BUG DETECTION &amp; REPAIR PIPELINE
          </p>
          <h1 id="page-title">Evidence before automation.</h1>
          <p className="lead">
            A small, verifiable foundation for safer debugging. This build
            proves the local connection from dashboard to API to database.
            Nothing more is quietly running behind it.
          </p>
          <div className="phase-label">
            Phase 1 <span>/</span> Working skeleton
          </div>
        </section>

        <section className="connection-card" aria-labelledby="connection-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">01 / FOUNDATION CHECK</p>
              <h2 id="connection-title">Is the local stack connected?</h2>
            </div>
            <span className={data ? 'badge ready' : 'badge'}>
              {data
                ? 'DATABASE VERIFIED'
                : pending
                  ? 'CHECKING'
                  : 'UNAVAILABLE'}
            </span>
          </div>

          <ol className="pipeline" aria-label="Request path">
            <li>
              <span className="step-number">01</span>
              <strong>Dashboard</strong>
              <small>React + TypeScript</small>
            </li>
            <li>
              <span className="step-number">02</span>
              <strong>API</strong>
              <small>Spring Boot + Java 21</small>
            </li>
            <li>
              <span className="step-number">03</span>
              <strong>Database</strong>
              <small>PostgreSQL + Flyway</small>
            </li>
          </ol>

          <div className="check-result" aria-live="polite">
            {state.kind === 'loading' && <p>Connecting to the local API...</p>}
            {state.kind === 'checking' && (
              <p>Validating the synthetic request and reading PostgreSQL...</p>
            )}
            {state.kind === 'ready' && (
              <p>
                The API read the migration-owned synthetic fixture. Ready for a
                validated round trip.
              </p>
            )}
            {state.kind === 'verified' && (
              <p className="success">
                Synthetic check passed. Input was validated and the fixture was
                read from PostgreSQL.
              </p>
            )}
            {state.kind === 'error' && (
              <div role="alert">
                <strong>Connection check failed.</strong>
                <p>{state.message}</p>
                <p>Check this project's API and database, then try again.</p>
              </div>
            )}
          </div>

          <div className="check-actions">
            <button
              type="button"
              disabled={pending}
              onClick={() => void check()}
            >
              {state.kind === 'checking'
                ? 'Checking...'
                : 'Run synthetic check'}
            </button>
            <p>Read-only. No telemetry or personal data is submitted.</p>
          </div>
          {data && (
            <p className="fixture">
              Fixture <code>{data.fixtureId}</code> <span> / </span> Phase{' '}
              {data.phase}
            </p>
          )}
        </section>

        <section className="scope-grid" aria-label="Implementation boundaries">
          <article>
            <p className="eyebrow">AVAILABLE NOW</p>
            <h2>A tested foundation</h2>
            <ul>
              <li>Containerized web, API, and PostgreSQL</li>
              <li>Health checks and schema migration</li>
              <li>Validated synthetic request and explicit errors</li>
            </ul>
            <a href="/openapi.yaml">
              View the implemented API contract{' '}
              <span aria-hidden="true">-&gt;</span>
            </a>
          </article>
          <article className="deferred">
            <p className="eyebrow">NOT IMPLEMENTED</p>
            <h2>The repair engine comes later</h2>
            <ul>
              <li>Telemetry, tracing, and failure clustering</li>
              <li>Seeded bugs and automated reproduction</li>
              <li>AI patches, pull requests, or deployments</li>
            </ul>
            <p>
              Automation is disabled. Future patches require human approval.
            </p>
          </article>
        </section>
      </main>

      <footer>
        <p>Independent prototype. Not affiliated with Interfere.</p>
        <p>Local-only development build / not production-ready</p>
      </footer>
    </div>
  );
}
