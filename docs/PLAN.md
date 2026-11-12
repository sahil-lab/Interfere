# Execution plan and observed evidence

## Authorized scope

Only this Interfere directory, Phase 0 then Phase 1. No other sessions are
activated. No cloud, real data, destructive cleanup, or Git write operation.

## Phase gates

| Phase                         | Status                                             | Completion boundary                                                                                                         |
| ----------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 0 - Contract and safety       | Local deliverables complete; Git approval deferred | Requirements, architecture, threat model, decisions, measurable criteria, conventions, local workflow, manual CI definition |
| 1 - Working skeleton          | Implemented and verified                           | Backend, frontend, PostgreSQL, Compose, health, migrations, validation, tested end-to-end synthetic check                   |
| 2 - Core data/APIs            | Not started                                        | Domain schema, contracts, permissions, idempotency, state transitions                                                       |
| 3 - Functional engine         | Not started                                        | Seeded bugs, collection/redaction, clustering, deterministic reproduction                                                   |
| 4 - Agent/automation          | Not started                                        | Explicit adapters, budgets, traces, human-approved patch proposals                                                          |
| 5 - Reliability/observability | Not started                                        | Retry/failure controls, distributed tracing, metrics and chaos tests                                                        |
| 6 - Evaluation/packaging      | Not started                                        | Measured bug/reproduction benchmarks, demo, packaging                                                                       |

## Discovery evidence (2026-11-11)

- Read all 3 pages of `06_Interfere_Self_Healing.pdf`, including every included
  prompt and the final evaluation/research sections.
- Initial project contents: the PDF only. No `.git` metadata was present.
- `docker version --format '{{json .}}'`: Docker Desktop server responding,
  Engine 29.4.1, Linux/amd64.
- `docker info --format 'OSType={{.OSType}} CPUs={{.NCPU}} MemoryBytes={{.MemTotal}}'`:
  Linux, 22 logical CPUs, 16,467,517,440 bytes engine memory.
- `docker compose version`: v5.1.3.
- `Get-NetTCPConnection -State Listen -LocalPort 18106,18206`: no listening
  sockets observed at discovery.
- `docker ps --filter 'label=com.docker.compose.project=interfere'`: no existing
  Interfere containers observed.
- Public package metadata was consulted without uploading project data.
  Spring Boot 3.5.16, React 19.3.1, TypeScript 7.0.2, Vite 8.3.8,
  React Vite plugin 6.3.0, Vitest 5.1.0, and Prettier 3.9.10 were reported.
  Node 24 satisfies the reported Vite/Vitest runtime requirements.

## Commands executed

Run from `C:\Users\upadhsah\Desktop\project\Interfere` in PowerShell. All compilation,
formatting, tests, dependency restores, and browser execution used project-scoped
containers; host Node and Java were not used.

```powershell
.\scripts\dev.ps1 init
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps api-tools mvn --batch-mode --no-transfer-progress -f services/api/pom.xml spotless:apply
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-tools npm run format
.\scripts\dev.ps1 check | Tee-Object -FilePath .\docs\verification-final.log
.\scripts\dev.ps1 up
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps smoke
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps browser
docker compose -p interfere --env-file .env -f infra\docker\compose.yaml ps
docker compose -p interfere --env-file .env -f infra\docker\compose.yaml exec -T db psql -U interfere -d interfere -c "SELECT version, success FROM flyway_schema_history ORDER BY installed_rank;"
docker compose -p interfere --env-file .env -f infra\docker\compose.yaml exec -T db psql -U interfere -d interfere -c "SELECT fixture_id, COUNT(*) FROM skeleton_fixtures GROUP BY fixture_id;"
docker inspect --format 'Name={{.Name}} Health={{.State.Health.Status}} Ports={{json .NetworkSettings.Ports}} Memory={{.HostConfig.Memory}} NanoCPUs={{.HostConfig.NanoCpus}} PidsLimit={{.HostConfig.PidsLimit}} ReadOnly={{.HostConfig.ReadonlyRootfs}} Log={{json .HostConfig.LogConfig}}' interfere-api-1 interfere-db-1 interfere-web-1
docker stats --no-stream --format 'Name={{.Name}} Memory={{.MemUsage}} PIDs={{.PIDs}}' interfere-api-1 interfere-db-1 interfere-web-1
```

The `check` command performs, in order:

1. `docker info`, local environment initialization, and `compose config --quiet`.
2. `web-tools npm ci --no-audit --no-fund` using the persisted lockfile.
3. `api-tools mvn --batch-mode --no-transfer-progress -f services/api/pom.xml verify`
   (Spotless, compilation, 15 Java tests, and executable JAR packaging).
4. `web-tools npm run verify`
   (Prettier check, 6 Vitest tests, `tsc --noEmit`, and Vite production build).
5. `compose build api`, then `compose build web`.
6. `compose up -d --no-build --wait --wait-timeout 180 db api web`.
7. Real host HTTP checks for both ports and the web-proxied DB-backed API.
8. The `smoke` service (7 real HTTP tests), then the `browser` service
   (2 real Chromium tests), then `compose ps`.

Each Compose invocation explicitly uses project `interfere`, this project's
environment file and Compose file. Tool containers are temporary `run --rm`
instances; the three runtime services intentionally remain available.

## Results

**Final full `check` invocation: exit 0**, after recovering from the interruption
described below. Final Java run finished at `2026-11-11T17:58:40Z`; the HTTP and
browser tests passed afterward in that same invocation.

| Gate                  | Observed result                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spotless              | All 8 Java source/test files clean; no formatter failure                                                                                                   |
| Java                  | Java 21 compilation succeeded on the initial run; final incremental verify passed 15 tests, 0 failures/errors/skips; JAR packaged                          |
| Repository formatting | Prettier: all matched files use the expected style                                                                                                         |
| Frontend              | 6/6 Vitest tests; strict TypeScript check passed; Vite production bundle built                                                                             |
| Runtime images        | API and web images built successfully from verified artifacts                                                                                              |
| Host listeners        | Web `127.0.0.1:18106` and API `127.0.0.1:18206` respond; DB-backed host web proxy succeeds                                                                 |
| HTTP smoke            | 7/7 tests passed in the final gate; health, production assets, exact response shape, strict invalid-input rejection, request IDs, and absent future routes |
| Chromium              | 2/2 passed: desktop keyboard -> actual API -> PostgreSQL; mobile injected 503 is visible and a real retry succeeds                                         |
| Browser boundaries    | Desktop test observed only the app's origin and no page errors; mobile 390px viewport had no horizontal overflow                                           |
| PostgreSQL            | Flyway version 1 has `success=t`; exactly one `synthetic-demo` fixture after API recreations and stack recovery                                            |
| Isolation             | All three services healthy; DB has no published port; DB joins only the internal network; all runtime filesystems read-only                                |
| Resource limits       | API 512 MiB / 0.75 CPU; DB 256 MiB / 0.5 CPU; web 64 MiB / 0.25 CPU; each capped at 128 PIDs and two 5 MiB log files                                       |
| Observed footprint    | One final snapshot: API 148.1 MiB / 23 PIDs, DB 15.57 MiB / 8 PIDs, web 2.227 MiB / 2 PIDs; not a benchmark or peak measurement                            |
| Cleanup/scope         | Only the 3 intended runtime containers remain; no test/build helper remains running; no `.git` directory                                                   |

The final gate's stdout is retained locally in [verification-final.log](verification-final.log).
Java XML/text test reports are generated under
`services/api/target/surefire-reports`. Build artifacts, dependencies, generated
logs, and the generated local `.env` are ignored by the Git ignore rules.
No secret value is recorded in this document.

### Failures found, fixed, or explicitly bounded

1. **Real host-port failure:** the first internal smoke suite passed but host
   curl/browser requests were refused. Docker kept requested bindings while
   actual published ports were empty for internal-only web/API networking.
   Fixed by a separate edge bridge for web/API and an internal-only DB network.
   Host HTTP checks are now mandatory in `up` and `check`.
2. **Windows health parsing:** PowerShell interpreted Actuator's vendor
   `+json` response as `byte[]`, causing a missing `status` property error.
   Fixed by requesting `Accept: application/json`. The host gate now passes.
3. **Build concurrency:** a combined Compose build used concurrent Bake
   targets despite `--parallel 1`. Runtime builds now use separate commands;
   dependency installation and application compilation were already bounded
   sequential tooling-container jobs.
4. **Integrated-browser automation limitation:** the editor browser rendered
   the page, but interaction attempts timed out and its page handle disappeared.
   Replaced this verification path with pinned, non-root, bounded Playwright
   Chromium tests; both tests passed repeatedly. No editor settings were changed.
5. **Interrupted full gate:** an earlier final run passed Java/frontend checks
   and builds, then failed the 180-second readiness wait. Docker CLI calls
   subsequently stalled; after tool interruption, API/DB were observed exited
   with code 255 and web was still Created. The underlying shared-host cause was
   not established. No daemon restart, global cleanup, other-project stop, or
   timeout inflation was performed. Once Docker responded, only Interfere was
   started, all real-service checks passed, then the entire `check` command
   passed from start to finish. Earlier stdout remains in
   [verification.log](verification.log); it is not evidence of a passing gate.

### Runtime/toolchain evidence

- Node `v24.22.2`; Java build logs: `21.0.12.1`; API runtime:
  Temurin `21.0.13+9`; PostgreSQL `17.11`; Nginx `1.30.6`.
- Playwright `1.65.0`, matching browser image; npm dependencies are locked.
- Observed image digests (family tags remain mutable):

| Image                                        | Digest                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `node:24-bookworm-slim`                      | `sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9` |
| `maven:3.9-eclipse-temurin-21`               | `sha256:99e61abcff91a9b1333463bd8451fb18495d6eba9250ac66a338b518f8278320` |
| `postgres:17-alpine`                         | `sha256:3540c0362c809df084ffac0ae69fe794515f9de92692f02178bcdce0ef0302ac` |
| `eclipse-temurin:21-jre-alpine`              | `sha256:ac05c3c42b7c2f1a52c9bd52f01041fa1958231b15ebeae7420429cbc5baf474` |
| `nginxinc/nginx-unprivileged:stable-alpine`  | `sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03` |
| `mcr.microsoft.com/playwright:v1.65.0-noble` | `sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d` |

## Files added

The initial directory contained only the PDF, which was not modified.
These 46 source/configuration/documentation files were added, including the
package-manager-generated lockfile:

```text
.dockerignore
.editorconfig
.env.example
.gitattributes
.github/workflows/ci.yml
.gitignore
.npmrc
.prettierignore
.prettierrc.json
README.md
package.json
package-lock.json
playwright.config.mjs
apps/web/index.html
apps/web/package.json
apps/web/tsconfig.json
apps/web/vite.config.ts
apps/web/src/api.test.ts
apps/web/src/api.ts
apps/web/src/App.tsx
apps/web/src/main.tsx
apps/web/src/styles.css
docs/ARCHITECTURE.md
docs/DECISIONS.md
docs/PLAN.md
docs/PRD.md
docs/THREAT_MODEL.md
infra/docker/api.Dockerfile
infra/docker/compose.yaml
infra/docker/nginx.conf
infra/docker/web.Dockerfile
packages/contracts/openapi.yaml
scripts/dev.ps1
services/api/pom.xml
services/api/src/main/java/dev/interfere/api/ApiExceptionHandler.java
services/api/src/main/java/dev/interfere/api/InterfereApplication.java
services/api/src/main/java/dev/interfere/api/RequestLogFilter.java
services/api/src/main/java/dev/interfere/api/SkeletonController.java
services/api/src/main/java/dev/interfere/api/SkeletonService.java
services/api/src/main/java/dev/interfere/api/SkeletonStatus.java
services/api/src/main/resources/application.yaml
services/api/src/main/resources/db/migration/V1__create_synthetic_fixture.sql
services/api/src/test/java/dev/interfere/api/SkeletonControllerTest.java
services/api/src/test/java/dev/interfere/api/SkeletonServiceTest.java
tests/e2e/browser.spec.mjs
tests/e2e/smoke.test.mjs
```

Additional generated local state: ignored `.env`, `node_modules`,
`apps/web/dist`, `services/api/target`, and the two verification logs.
Docker uses project-scoped data/cache volumes; no authored file was placed
outside this project.

## Remaining limitations and permission gates

- No blocking failure remains in the tested Phase 1 scope.
- Git initialization is deliberately not done; it requires separate approval.
  No commits, remotes, pushes, or remote CI executions occurred.
- The manual-only CI definition is authored but **not remotely verified**.
- Mockito reports dynamic-agent-loading warnings on Java 21 during tests.
  They do not fail the current supported Java 21 gate; a future JDK upgrade
  needs explicit test-agent configuration.
- Shared Docker/host availability can interrupt startup; scripts fail explicitly
  instead of returning a successful check when this happens.
- No full security audit, production authentication, actual database-outage
  chaos test, telemetry redaction engine, distributed tracing, or load benchmark
  has been completed. The browser 503 scenario is explicitly injected.
- All domain features and the guide's detection/reproduction benchmarks remain
  unimplemented. No cloud, real data, production modifications, or Git actions
  were used.

## Next step

Stop at the Phase 1 boundary. Await authorization for Phase 2: agree the domain
contracts, permissions/consent model, idempotency, and observable state transitions
before implementing the domain tables and APIs. Request Git initialization
permission separately if repository operations become necessary.

## 2026-11-12 - Editorial UI redesign

### Scope and design

The user requested a substantially more art-directed experience rather than
another dashboard reskin. This is a **UI-only iteration**; it does not advance
the engineering phases or implement a repair engine.

- Replaced the neon card layout with a paper/ink/vermilion visual system,
  oversized typography, an original identity mark, distinct narrative sections,
  a focused proof console, native boundary disclosures, and a full-width footer.
- Added an original procedural signal-loop sculpture: pointer response,
  keyboard-operable interference slider, and pause/resume controls. It is
  explicitly labeled artwork, not live telemetry.
- Rendering is configured for at most 20 redraws/second and 1.5 device-pixel
  ratio. Animation stops offscreen or in hidden tabs; reduced-motion preferences
  start it paused. No WebGL/animation framework was added.
- Self-hosted pinned Manrope and IBM Plex Mono fonts with their original SIL
  Open Font Licenses distributed alongside the web app.
- Preserved actual synthetic API checks, error/retry UX, contract examples,
  configuration inspection, and deferred phase information.
- Corrected the previous UI's success counter and fabricated fallback JSON:
  the counter starts at zero, only validated responses count, and unavailable
  responses remain explicitly unavailable. The eight-entry ledger records only
  completed requests and is local to the current page.
- Inspector tabs implement Left/Right/Home/End keyboard navigation and proper
  tab/panel relationships. Configuration and input examples are explicitly
  distinguished from live measurements and executed checks.

### Commands and observed outcomes

Commands ran from this project directory. npm and Chromium continued to use the
existing bounded containers; no global runtimes were installed or replaced.

```powershell
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-tools npm install --no-audit --no-fund
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-tools npm run format
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-tools npm run verify
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml build web
.\scripts\dev.ps1 up
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps smoke
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps browser
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps browser ./node_modules/.bin/playwright test --grep 'signal artwork' --output=/tmp/interfere-browser-results
```

| Check                | Observed result                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier             | Final source formatting check passed                                                                                                                                        |
| Frontend unit tests  | 6/6 passed                                                                                                                                                                  |
| TypeScript and Vite  | Strict typecheck and production build passed                                                                                                                                |
| HTTP smoke           | 7/7 passed against actual web/API/PostgreSQL                                                                                                                                |
| Chromium             | 5/5 passed: actual keyboard-initiated request, tab navigation, mobile failure/retry, initial failure honesty, reduced motion/art controls, and responsive geometry          |
| Extended motion test | The existing artwork case was extended and rerun alone: 1/1 passed; actual canvas pixels change after resuming and remain stable when paused                                |
| Responsive layout    | Document width did not exceed viewport width at 360, 390, 768, 1024, 1440, or 1920px                                                                                        |
| Visual inspection    | Captured and inspected desktop hero, full composition, console, and mobile renders in local Chromium; final 1440px and 390px captures had matching viewport/document widths |
| Fonts and CSP        | Both font families reported loaded; same-origin assets; successful-flow test observed no page/console errors and no external origins                                        |
| Local services       | Web 18106/API 18206 and the DB-backed host proxy passed; database remains unpublished                                                                                       |

The final Vite output reported 246.03 kB JavaScript (76.32 kB gzip) and 21.95 kB
CSS (5.64 kB gzip), plus local font assets. These are observed artifact sizes,
not a Lighthouse score, browser performance benchmark, or an award claim.

### Failures fixed during this iteration

1. The font package did not expose the assumed `latin.css` entry. Using its
   full stylesheet then exposed a CSP-blocked inlined font. The final code
   references the actual Latin WOFF2 asset explicitly, without loosening CSP.
2. `crypto.randomUUID()` was unavailable on the browser container's plain-HTTP
   `web` origin and crashed the ledger renderer. Replaced it with an in-memory
   sequence for local React keys; this is not a replacement for server request
   IDs or a cryptographic identifier.
3. Decorative CSS guide-line transforms extended the mobile scroll area by
   12-15px. Replaced them with bounded SVG geometry; did not hide page overflow
   or clip meaningful content to make the test pass.
4. Integrated-browser screenshots were unavailable and page handles expired.
   Visual validation used the existing bounded Chromium container instead;
   temporary captures stayed inside this project and were removed afterward.

### Files changed in this UI iteration

- Updated: `apps/web/src/App.tsx`, `apps/web/src/styles.css`,
  `apps/web/src/main.tsx`, `apps/web/index.html`, `apps/web/package.json`,
  `package-lock.json`, `tests/e2e/browser.spec.mjs`, `tests/e2e/smoke.test.mjs`,
  `README.md`, and this execution record.
- Added: `apps/web/src/SignalField.tsx`,
  `apps/web/src/VerificationLab.tsx`, `apps/web/public/icon.svg`,
  `apps/web/public/licenses/manrope.txt`, and
  `apps/web/public/licenses/ibm-plex-mono.txt`.
- Backend, API contract, migrations, Compose settings, and host tooling were
  not changed. Java tests were not rerun for this frontend-only iteration;
  the earlier Phase 1 results above remain historical evidence.

No blocking UI failure remains in the tested scope. No cloud, real data, other
project/session changes, Git initialization, commits, remotes, or pushes were
performed. A full accessibility audit and production readiness are not claimed.
The next step is design review of the running page; Phase 2 remains a separate
authorization decision.

Handoff observation: `Test-Path .git` returned `True` at the end of this UI
iteration. This iteration did not run Git commands or create that metadata;
it was left untouched. The earlier Phase 1 absence check above is historical,
not a claim about the current directory.
