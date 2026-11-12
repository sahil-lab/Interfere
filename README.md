# Interfere - verified bug detection and repair prototype

An independent engineering prototype inspired by the public product area of
Interfere. It is not affiliated with the company and uses no private systems,
incidents, repositories, or user data.

## Current scope

This iteration implements **Phase 0 (contract and safety)** and **Phase 1
(working skeleton)** from the [three-page engineering guide](06_Interfere_Self_Healing.pdf).
The intended skeleton is React/TypeScript -> Spring Boot/Java 21 -> PostgreSQL,
using one immutable synthetic fixture to verify connectivity and validation.

The bug detection/repair engine is **not implemented**. There is no telemetry
collection, seeded application bug, clustering, reproduction, AI agent, patch
generation, Git integration, production deployment, Redis, or Kafka.
See the [execution record](docs/PLAN.md) for observed results, not inferred status.

## Local workflow

Prerequisite: Docker Desktop running Linux containers with Docker Compose.
Builds run in resource-limited Node 24 and Maven/Java 21 containers. Host Node
and Java are not used or replaced. Run from this project directory in PowerShell:

```powershell
.\scripts\dev.ps1 check
```

This initializes an ignored local database password, restores locked frontend
dependencies, checks formatting, runs unit tests, builds artifacts/images, starts
the isolated stack, verifies host access, and runs HTTP and Chromium end-to-end
checks. The bounded browser container uses only synthetic data and is removed
after its test run.

- Dashboard: <http://localhost:18106>
- API readiness: <http://localhost:18206/actuator/health/readiness>
- OpenAPI: <http://localhost:18206/openapi.yaml>
- Compose project: `interfere`; PostgreSQL has **no published host port**.
- Host bindings are restricted to `127.0.0.1`.
- Only synthetic, read-only checks are exposed; do not submit real data.

Other commands:

```powershell
.\scripts\dev.ps1 format
.\scripts\dev.ps1 build
.\scripts\dev.ps1 up
.\scripts\dev.ps1 stop
```

`stop` stops only this Compose project's services. It does not delete database
volumes. No script prunes Docker, modifies another project, initializes Git,
adds remotes, commits, pushes, or deploys to a cloud.

## Design and limitations

The UI uses a paper/ink/vermilion editorial design with a locally rendered,
interactive signal sculpture and a live proof console. The sculpture is
illustrative artwork, **not telemetry**. Its slider never sends a request;
animation pauses offscreen, in hidden tabs, and by default for reduced-motion
preferences. A pause control is always available.

The console displays only observed API results, browser-measured round-trip
time, and an eight-entry in-memory session ledger. Failed or pending requests
do not invent a response or increment verified reads. The keyboard-navigable
inspector separates real responses from static contract examples and declared
Compose settings. The latter are not live Docker metrics.

Manrope and IBM Plex Mono are self-hosted through pinned Fontsource packages.
No font CDN, analytics, animation framework, or external runtime service is
used. Their SIL Open Font Licenses ship at `/licenses/manrope.txt` and
`/licenses/ibm-plex-mono.txt`.

- [Requirements and measurable acceptance criteria](docs/PRD.md)
- [Architecture and implemented interfaces](docs/ARCHITECTURE.md)
- [Threat model and approval boundaries](docs/THREAT_MODEL.md)
- [Decisions and coding conventions](docs/DECISIONS.md)
- [Phase plan, commands, evidence, and next step](docs/PLAN.md)
- [API contract](packages/contracts/openapi.yaml)

This is an unauthenticated loopback-only development skeleton, not a production
service. Database credentials remain in an ignored local environment file.
Readiness must fail when storage is unavailable; the UI must report errors rather
than display fabricated success. OpenTelemetry collection, authentication,
consent enforcement for future telemetry, retention controls, rate limits,
resilience testing, and all repair-engine benchmarks remain future work.

The guide's targets (detecting at least four of five seeded bugs and reproducing
at least three) belong to later phases. No such result is claimed here.

## Troubleshooting

- If Docker does not respond, start Docker Desktop in Linux-container mode.
- If ports 18106 or 18206 are occupied, stop here rather than changing or stopping
  another project's services.
- A formatting failure is fixed with `.\scripts\dev.ps1 format`, then `check`.
- Inspect only this stack with
  `docker compose -p interfere --env-file .env -f infra\docker\compose.yaml ps`.
- Inspect its logs with
  `docker compose -p interfere --env-file .env -f infra\docker\compose.yaml logs --tail 80 api web db`.
- Do not print the expanded Compose configuration, database password, or
  container environment variables.
- The optional CI workflow is manual-only and has not been activated remotely.
