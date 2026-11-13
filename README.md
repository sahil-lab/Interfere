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

The UI is a dark, scroll-driven page built around one generative WebGL field
that follows the visitor down the page and re-forms for each chapter: a tangle
(noise), a woven loop (signal), a waveform scope (evidence), and a fingerprint
(human). It is drawn with raw WebGL in `apps/web/src/field`; there is no 3D or
animation library and nothing is loaded from a CDN.

The field is illustrative artwork, **not telemetry**, and is labeled as such
on the page. Its idle motion is ambient and its slider never sends a request.
The only events it responds to are the pointer, scrolling, and the result of
a synthetic check the visitor ran: a verified response sends a wave through
the scope, a failed one scatters it. It never shows a success that did not
happen.

- Motion can be paused with the control in the hero. `prefers-reduced-motion`
  starts it paused, skips the opening sequence, unpins the scroll-driven
  chapters, removes the custom cursor, and keeps the browser's own scrolling.
- Detail adapts: sustained slow frames reduce points, strands, and resolution
  once and never raise them again. Software-rendered WebGL gets a small
  half-resolution field capped near 20 frames a second. Without WebGL the
  page shows a static gradient and everything else still works.
- `?field=full`, `?field=lite`, and `?field=off` override the automatic
  choice. They change only the artwork.
- The footer and the opening curtain are 99.6% opaque rather than solid.
  Solid ones left part of the page unpainted in a Chromium that composites
  without a GPU; D009 in the decisions record has the evidence and its limits.
- The mouse wheel is eased in script; keyboard, touch, scrollbar, and in-page
  links use native scrolling, and any key or pointer press ends a wheel
  glide at once (D010).
- Known issue, cause not found: in a software-rendered Chromium, the End key
  was ignored roughly one press in six while the field was drawing. A second
  press usually worked. It did not happen with the artwork off or still, and
  it was not tested on a GPU.

The console displays only observed API results, browser-measured round-trip
time, and an eight-entry in-memory session ledger. Failed or pending requests
do not invent a response or increment verified reads. The keyboard-navigable
inspector separates real responses from static contract examples and declared
Compose settings. The latter are not live Docker metrics.

Manrope, Instrument Serif, and IBM Plex Mono are self-hosted through pinned
Fontsource packages. Their SIL Open Font Licenses ship at
`/licenses/manrope.txt`, `/licenses/instrument-serif.txt`, and
`/licenses/ibm-plex-mono.txt`. No analytics or external runtime service is
used, and the Content Security Policy is unchanged.

This is a visual design for a local prototype. It has not been submitted to,
reviewed by, or recognised by any awards site, and no Lighthouse score or
full accessibility audit is claimed.

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
- The services have no restart policy, so they stay stopped after Windows or
  Docker restarts. Start Docker Desktop, then run `.\scripts\dev.ps1 up`.
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
