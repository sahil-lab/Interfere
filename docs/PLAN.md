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

## 2026-11-12 to 2026-11-13 - Immersive WebGL redesign

### Scope and design

The user found the editorial design above too plain and asked for an
expressive, scroll-driven experience. This iteration replaces that design. It
is **UI-only**: it does not advance the engineering phases, and the API, its
contract, the migrations, the Compose file, the scripts, and the Content
Security Policy are unchanged.

- One full-page WebGL field, written against raw WebGL with seeded geometry
  (`apps/web/src/field`): 72 strands drawn as lines plus 64,512 points at full
  detail. It re-forms as the visitor reaches each chapter: a tangle, a woven
  loop, a ridgeline scope inside the proof console, and a fingerprint. The
  page labels it as art, not telemetry.
- The field responds to the pointer, to scrolling, to its noise slider, and to
  the result of a check the visitor ran. A verified response sends a wave
  through the scope and a failed one scatters it. Pending and failed checks
  never produce the success effect.
- Page choreography: an opening curtain whose count follows font and field
  readiness, masked headline reveals, a marquee that leans into the scroll, a
  pinned statement that lights word by word, a pinned chapter that moves three
  step cards sideways, a stamp that turns with the scroll, a footer wordmark
  that rises letter by letter, a cursor ring, magnetic buttons, a chapter
  rail, a header that hides while scrolling down, and eased mouse-wheel
  scrolling.
- The proof console keeps every rule from the previous iteration: only
  observed responses, a counter that starts at zero, no placeholder JSON, and
  examples and Compose settings labeled as not executed and not live.
- Instrument Serif italic was added for accents. It is self-hosted like the
  other two fonts and its SIL Open Font License ships at
  `/licenses/instrument-serif.txt`. Vite is configured never to inline assets
  as `data:` URIs, as a guard for the same-origin policy.
- Motion is optional. `prefers-reduced-motion` gets a still field, no opening
  curtain, unpinned chapters, native scrolling, and no cursor ring. A pause
  control is always present. `?field=full`, `?field=lite`, and `?field=off`
  override the automatic choice of detail.

### Commands and observed outcomes

Commands ran from this project directory in the existing bounded containers.
No global runtime was installed or replaced.

```powershell
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-tools npm install --no-audit --no-fund
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-tools npm run format
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-tools npm run verify
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml build web
.\scripts\dev.ps1 up
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps smoke
docker compose --progress quiet -p interfere --env-file .env -f infra\docker\compose.yaml --profile tools run --rm --no-deps browser
```

Three builds were tested on 2026-11-13. Build A is the immersive design with
solid covers (frontend built 02:23 UTC). Build B adds the cover colours of
D009 (07:59 UTC). Build C, the final one, adds the wheel fix of D010
(09:00 UTC). Results on build C:

- Prettier check passed.
- Frontend unit tests: 12 of 12. Six cover the API boundary. Six cover the
  field geometry: it is deterministic, finite, and inside the bounds the
  renderer fits; the fingerprint surrounds its core; a reduced draw count
  still covers every strand; lines join only neighbouring points of one
  strand; and a drawn prefix of lines is spread across the field.
- Strict typecheck and production build passed. JavaScript is 274.58 kB
  (86.62 kB gzip) and CSS is 32.44 kB (7.92 kB gzip), plus four font files of
  13 to 25 kB. These are artifact sizes, not a performance score.
- `dev.ps1 up` host checks passed for web 18106, API 18206, and the
  database-backed proxy.
- HTTP smoke: 7 of 7 against the real web, API, and PostgreSQL.
- Chromium: 12 of 12 in each of three runs, of 2.2, 2.0, and 2.1 minutes.
  The cases are: a keyboard-started request reaching PostgreSQL with the
  exact response
  and keyboard navigation of the inspector; a phone-width failure that shows
  no success and recovers on a real retry; an initial failure that creates no
  verified read or response; the field drawing lit pixels, following the
  chapters, and drawing nothing while paused; the statement scrub and the
  sideways steps; the wheel landing exactly where native scrolling would; a
  key pressed after a wheel glide scrolling the page natively, checked with
  the artwork off for the reason given below; a chapter link pressed during
  a glide still reaching its chapter; the dark page reaching the screen in
  every chapter and above the footer; the page and console working with the
  artwork switched off; reduced motion; and no overflow or clipped headline
  at 360, 768, 1024, 1440, and 1920 px.
- On builds A and B the suite had 10 cases. It passed once on A (1.8
  minutes) and once on B (1.6 minutes), then failed once on B: the End-key
  step of the wheel case timed out. That failure led to item 10 and to the
  open issue below.

Visual review, all in the software-rendered test browser:

- Phone, 390 x 844 at 2x, full detail, on builds B and C: 15 frames captured
  each time. The curtain, hero, console after a verified check, and
  fingerprint were inspected on B; the pinned steps on C; the end of the
  page on both.
- Desktop, 1440 x 900, full detail: 15 frames captured on build A. The hero,
  statement, steps, lab heading, console, fingerprint, and footer frames were
  inspected. Builds B and C were not captured at desktop size.
- Each formation was also captured in close crops at full and reduced detail
  and reworked over several rounds.

On real hardware, build A was opened in the editor's
integrated browser, which reported an Intel Arc GPU through ANGLE and
Direct3D 11, at 1024 x 768 and 1.5x. The full-detail field initialised with
64,512 points and the hero rendered as designed. That tab was in the
background, where browsers do not fire animation frames, so frames were
delivered by script for one walk down the page: all four formations were
reached, a synthetic check ran and verified, and at the end the sampled area
above the footer (the top-left 390 x 91 px) was fully painted. **No frame
rate was measured on a real GPU.** That browser ignored a request for a
phone-sized viewport, so the phone layout was not seen on a GPU.

Frame rates were measured only in the software-rendered test browser, which
is limited to one CPU, and only mid-iteration, before strand lines were
added: about 9 field frames a second at reduced detail, under 2 when full
detail was forced, and 60 animation frames a second with the field off. They
show why that browser gets reduced detail. They say nothing about a GPU.

### Failures found and fixed

1. The opening curtain took about 29 seconds in the software-rendered
   browser. Its count eased by a fixed fraction per frame, so three frames a
   second stretched it. The count is now time-based. Separately, the shared
   clock capped a frame at 50 ms, which put all motion into slow motion on a
   slow device. That cap is now 250 ms.
2. Full detail drew two to three frames a second on software-rendered WebGL.
   Such browsers now get a smaller field at half resolution, with no
   full-screen pass, capped near 20 frames a second.
3. The first field was a cloud of separate points and read as a blur. It was
   rebuilt as a small number of long strands drawn as lines, with points as
   dust around them. The fingerprint and scope were redrawn to match.
4. Formations first changed in step with the scroll position, so stopping
   mid-way left the field half-assembled across the text. A change is now
   triggered by position and then plays out in time, and points dim while in
   transit.
5. The page was wider than a phone screen twice: by 49 px, which went away
   when the hero control row was rebuilt, then by 1 px from the corners of
   the turning stamp, which is now clipped to its circle. The Chromium suite
   checks for overflow at six widths.
6. Additive light piled up when a formation was drawn small, washing out the
   phone layout. Brightness is now scaled by on-screen size.
7. The scope spilled out of its window on phones and at its near corners. It
   is now fitted to a box that leaves room for both labels.
8. When detail stepped down, drawing fewer lines removed one side of a
   formation. Strand order is now shuffled, with a unit test.
9. The software-rendered browser left part of the page unpainted above the
   footer. The next section records how that was traced and avoided.
10. A chapter link pressed while a wheel glide was still in flight did
    nothing. The glide sets the scroll position every frame, and its next
    step cancelled the scroll the link had just started. In a probe on build
    B, the link worked both times with no wheel and failed all four times
    when pressed 40 ms or 400 ms after one. A key or pointer press now ends
    the glide (D010). The Chromium case added for this failed 3 of 3 times
    on build B and passed 13 of 13 times on build C.

### A blank area above the footer: found, traced, and avoided

At the end of the page at 390 px wide, with full detail forced, the
software-rendered test browser left a rectangle above the footer unpainted,
with the page text drawn over it. The canvas itself held the correct pixels,
so the fault was in what reached the screen, not in what was drawn.

What settled it, on 2026-11-13:

| Capture at phone width and full detail      | Covers       | Unpainted share |
| ------------------------------------------- | ------------ | --------------- |
| Build A                                     | solid        | 0.8217          |
| Build B, as built                           | 99.6% opaque | 0               |
| Build B, served with both values made solid | solid        | 0.8217          |
| Build C, the final build                    | 99.6% opaque | 0               |

Each capture walks the page top to bottom, runs a synthetic check, opens the
input guards, and measures a full screenshot at the end. The share is the
fraction of pixels above the footer that are pure black, which is how an
unpainted pixel decodes; the painted page is never pure black. A capture
takes about nine minutes, because that browser draws full detail at well
under one frame a second. Counting three earlier solid-cover captures and
one earlier 99.6% capture, the fault appeared in five of five captures with
solid covers and in none of the three without.

The captures, and the probes in the sections below, were made with a
temporary Playwright script in the bounded `browser` container. It was
removed afterwards, so the suite contains no nine-minute case.

The cause, as far as it was established, is in D009: Chromium's software
compositor mirrors the still-visible rectangle of a WebGL canvas when an
opaque layer hides part of it. The geometry matches. The unpainted rectangle
was 393 px tall, which is the visible height of the footer, and the 58 px
strip between it and the footer was painted.

Still not known:

- Which page state makes the footer hide the canvas. Jumping straight to the
  end did not reproduce the fault at reduced or full detail, with a solid
  footer forced onto its own layer or with content animating just before
  it. An earlier test with a new opaque layer over the lower canvas did not
  either.
- Whether any browser that composites on a GPU is affected. None is expected
  to be, and the one real-GPU walk above was clean, but it was at 1024 px.

Consequences:

- The footer and both curtain layers are 99.6% opaque. No other full-width
  background in the stylesheet is solid.
- The Chromium case that checks on-screen colours at phone width runs at
  reduced detail, where solid covers pass too. It is a general guard and
  does not protect this fix. Nothing automated does.
- This change had been made once before and then reverted, because eleven
  reduced-detail replays looked clean. That was a mistake: the fault had
  only been common at full detail. The first capture in the table is what
  corrected it.

### Not resolved: End is sometimes ignored in the software-rendered browser

The second run of the 10-case suite on build B failed its wheel case: after
the wheel assertions, End did not move the page within 12 seconds. Probing
showed that the wheel is not involved. In the software-rendered test
browser, End is sometimes ignored outright when it is pressed while the
field's canvas is drawing. The page receives the key event, does not cancel
it, and has focus. A second press usually works.

Each row is one probe of repeated rounds: jump to the top, wait half a
second, press End, and count the rounds in which the page had not reached
the bottom six seconds later (fifteen seconds in the first two rows). Rows
four, five, seven, and twelve used a looser test: whether the page had moved
at all.

| Condition                                             | End ignored |
| ----------------------------------------------------- | ----------- |
| Default page after a wheel glide, build B             | 2 of 14     |
| Default page after a wheel glide, build C             | 5 of 28     |
| Default page, no wheel input at all                   | 5 of 28     |
| Default page, CSS smooth scrolling switched off       | 4 of 28     |
| Default page, pointer never moved                     | 1 of 28     |
| Field paused                                          | 7 of 28     |
| Reduced-motion settings, field set drawing again      | 6 of 28     |
| Reduced motion, field still                           | 0 of 28     |
| Artwork off                                           | 0 of 28     |
| Artwork off, 80 ms of extra work added to every frame | 0 of 28     |
| A blank page of the same height                       | 0 of 28     |
| Default page, PageDown instead of End                 | 0 of 28     |

A later probe of the second row, with a six-second limit, counted 2 of 28.
The paused field is not a counter-example: by its code it keeps redrawing
for a couple of seconds after a jump, while the formation changes back, and
every round begins with a jump.

What this shows: the wheel code, CSS smooth scrolling, the pointer, and slow
frames are each ruled out, and a canvas that is not drawing is fine. What it
does not show is the cause, or whether a browser that composites on a GPU
does the same. Neither was established.

Consequences:

- The Chromium case for keyboard scrolling after a wheel glide runs with the
  artwork off, where End was reliable. End on the default page is not
  covered by any test.
- A visitor whose browser renders in software may have to press End twice.
- The README lists this as a known issue.

### Interruptions on 2026-11-13

Windows restarted twice during verification, at 11:34 and 13:00 local time.
The event log records both as restarts requested through the Windows shell
under the signed-in account, and neither shutdown completed cleanly. Nothing
in this project starts, stops, or restarts the machine.

- The services have no restart policy, so the stack was down after each
  restart.
- After the first, Docker Desktop was not running. It was started at the
  user's request. After the second, it was already running again.
- Each time, only `.\scripts\dev.ps1 up` was run, which starts this
  project's three services. No other project's containers were started,
  stopped, or removed, and nothing was pruned.

### Limits

- Only Chromium was exercised. Firefox and Safari were not opened.
- No physical phone, no real-GPU frame rate, no Lighthouse score, and no full
  accessibility audit.
- The mouse wheel is eased in script. It lands where native scrolling would
  and is off for reduced motion, but it is a deliberate override of a browser
  default.
- The design has not been submitted to, reviewed by, or recognised by any
  awards site.
- The cover colours of D009 have no automated guard, and the fault they
  avoid was never observed, or ruled out, at phone width on a GPU.
- End is sometimes ignored while the field is drawing in the
  software-rendered browser. The cause was not found and no GPU was tested.
- Java tests were not rerun for this frontend-only iteration.

### Files changed in this iteration

- Added: `apps/web/src/motion.ts`, `apps/web/src/icons.tsx`,
  `apps/web/src/kinetic.tsx`, `apps/web/src/chrome.tsx`,
  `apps/web/src/sections.tsx`, `apps/web/src/field/Field.tsx`,
  `apps/web/src/field/store.ts`, `apps/web/src/field/formations.ts`,
  `apps/web/src/field/formations.test.ts`, `apps/web/src/field/shaders.ts`,
  `apps/web/src/field/renderer.ts`, and
  `apps/web/public/licenses/instrument-serif.txt`.
- Rewritten: `apps/web/src/App.tsx`, `apps/web/src/VerificationLab.tsx`,
  `apps/web/src/styles.css`, `apps/web/public/icon.svg`, and
  `tests/e2e/browser.spec.mjs`.
- Removed: `apps/web/src/SignalField.tsx`.
- Updated: `apps/web/src/main.tsx`, `apps/web/index.html`,
  `apps/web/package.json`, `apps/web/vite.config.ts`, `package-lock.json`,
  `playwright.config.mjs`, `README.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, and this record.

No cloud, real data, other project or session, Git command, commit, remote,
or push was involved. Docker Desktop was started once, at the user's request,
after the first restart; nothing was pruned and no other project's
containers were touched. One public Chromium source file was read to trace
the fault in D009.
