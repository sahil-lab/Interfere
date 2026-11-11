# Requirements

## Source and scope

All three pages of the engineering PDF were read before implementation.
Page 1 defines the stack and sequential milestones; page 2 supplies the
start-from-zero, engine, and testing prompts; page 3 finishes the demo prompt
and gives the final product evaluation criteria.

Only the start-from-zero prompt's Phase 0 and Phase 1 are authorized now.
The subsequent engine, hardening, evaluation, and deployment prompts are
recorded as future work, not executed out of order.

## Problem and users

Engineering teams need evidence that a failure is reproducible before evaluating
a proposed repair. Technical evaluators need a reproducible local environment
with honest capability boundaries. This first slice proves the foundation only.

### Phase 1 user stories

1. As an evaluator, I can start the stack without installing Java or upgrading
   host Node, and see clearly which features are implemented.
2. As a developer, I can verify that the API reads a migration-owned synthetic
   fixture from PostgreSQL through the dashboard.
3. As a developer, I receive a clear client error for invalid requests without
   submitted values being echoed or recorded in application request logs.
4. As an operator of concurrent local projects, I can run this stack without
   occupying another project's ports or deleting any other project's resources.
5. As a reviewer, I can reproduce the checks and distinguish observed evidence
   from pending work.

## Implemented-slice interfaces

- `GET /api/skeleton/status`: read the immutable synthetic fixture from the DB
  and report the explicitly disabled engine capabilities.
- `POST /api/skeleton/check`: validate an allowlisted synthetic fixture ID, then
  perform the same read-only DB check. It does not create domain state.
- `GET /actuator/health/liveness`: process health, independent of DB availability.
- `GET /actuator/health/readiness`: application readiness including PostgreSQL.
- `GET /healthz` on the web listener: static-server health.
- `GET /openapi.yaml`: contract for implemented endpoints only.

## Phase 1 acceptance criteria

| ID    | Measurable criterion                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| P1-01 | Containerized formatter checks, Java compilation/tests, frontend type checking/tests, and production builds exit 0.                     |
| P1-02 | Web 18106 and API 18206 are bound to 127.0.0.1; no DB port is published; containers carry project label `interfere`.                    |
| P1-03 | Web health, API liveness, and DB-backed readiness return HTTP 200.                                                                      |
| P1-04 | Flyway migration V1 succeeds and creates exactly one immutable `synthetic-demo` fixture; repeated startup does not duplicate it.        |
| P1-05 | The dashboard -> web proxy -> API -> real PostgreSQL path returns the exact Phase 1 contract, not a static success placeholder.         |
| P1-06 | A valid synthetic check succeeds; missing, malformed, unexpected, and non-allowlisted input fails with a structured 4xx response.       |
| P1-07 | API errors include a server-generated request ID and never echo the rejected value; a DB read failure is explicitly a 503, not success. |
| P1-08 | A real browser can load the dashboard and complete the synthetic check; errors are visible and controls are keyboard accessible.        |
| P1-09 | No telemetry, repair operation, real-data import, cloud operation, or Git action is performed; future endpoints remain unimplemented.   |
| P1-10 | Runtime/build containers have explicit memory, CPU, PID, and log bounds; build jobs execute sequentially.                               |

## Non-goals and later acceptance targets

Phase 2 owns the domain tables (`sessions`, `events`, `traces`, `incidents`,
`reproductions`, `patches`, `validations`), authorization, idempotency, and state
transitions. Phase 3 owns five deliberately seeded demo bugs, redacted events,
failure clustering, root-cause relationships, and deterministic reproduction.
Phase 4 owns opt-in agent interfaces and human-approved patch proposals.
Phase 5 owns broader observability and reliability. Phase 6 owns reproducible
benchmarks, packaging, and a demo.

The final targets of finding >=4/5 seeded bugs, reproducing >=3 automatically,
zero automatic production deployments, and human approval for all patches are
not Phase 1 completion claims.
