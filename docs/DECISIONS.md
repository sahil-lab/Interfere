# Decisions and coding conventions

## D001 - Follow the guide's sequence

Implement Phase 0 and Phase 1 only. Do not interpret the broader sprint outline
or final definition of done as permission to implement the domain engine now.
The project stays an independent, synthetic proof of work.

## D002 - Keep the recommended stack; isolate the toolchain

Use Java 21 / Spring Boot 3.5, React / TypeScript / Vite, and PostgreSQL 17.
Node 24 and Maven/Java 21 run in Compose tooling containers, avoiding host Node 14
and absent host Java. No host runtime is replaced. npm versions are locked.

## D003 - Prove storage without implementing domain APIs

Use an immutable migration-owned fixture and clearly named `/api/skeleton/*`
routes. A read-only POST demonstrates input validation without prematurely
creating telemetry sessions, incidents, idempotency semantics, or permissions.
No success result is returned without an actual PostgreSQL read.

## D004 - Defer infrastructure without a current need

Do not start Redis, Kafka, a worker, an OpenTelemetry collector, an AI provider,
or any cloud resource. JSON request logs and health checks are present now;
distributed tracing and data collection are later work.

## D005 - Separate artifact compilation from small runtime image builds

Resource-limited tooling containers produce tested artifacts sequentially.
Runtime Dockerfiles copy those artifacts rather than running unbounded npm and
Maven builds inside shared BuildKit workers. A single Compose build runs at a
time. No independent builder daemon or Docker socket mount is needed.

## D006 - Do not initialize Git without permission

The guide asks for a repository, but the user has not approved Git initialization
for Interfere. The monorepo directory structure, ignore rules, conventions, and
manual-only CI definition can be authored without creating `.git`, remotes, or
commits. Remote CI is not run or claimed to pass.

## D007 - Verify host publication, not just internal health

Docker Desktop 29.4.1 kept requested `HostConfig.PortBindings` but produced empty
actual port mappings when web/API joined only an internal network. Internal
smoke tests passed while host HTTP and browser access failed.

Keep PostgreSQL on an internal-only network. Attach web/API to a separate edge
bridge with explicit loopback bindings, and test both host listeners plus the
host web -> API -> DB path in the normal `check` and `up` commands.
This bridge is not an outbound firewall; there are no external application
calls or telemetry integrations in the skeleton.

Build API and web runtime images in separate commands: Compose v5's Bake backend
was observed building both targets together despite `--parallel 1`.

## D008 - Art direction must not change what the page claims

The interface is deliberately expressive: a full-page WebGL field, pinned
scroll chapters, and kinetic type. Three rules keep that from eroding the
skeleton's honesty.

- The field is written against raw WebGL with seeded geometry, so it adds no
  runtime dependency, loads nothing from another origin, and renders the same
  shapes on every load. The existing Content Security Policy is unchanged;
  Vite is configured never to inline assets as `data:` URIs.
- The field is decoration and says so on the page. Its idle motion is
  ambient. The only events it responds to are the pointer, scrolling, and the
  result of a check the visitor ran, and a failed or pending check never
  produces the success effect.
- Motion is optional. Reduced-motion visitors get a still field, native
  scrolling, and unpinned chapters; everyone gets a pause control; slow
  devices get less detail rather than a slow page. The proof console works
  with the field paused, reduced, or unavailable.

## D009 - Covers that slide over the field are not fully opaque

The footer and both layers of the opening curtain use `--hot-cover` and
`--ink-cover`: the brand colours at 99.6% opacity (254 of 255).

- **What was seen.** In the software-rendered test browser, at 390 px wide
  with full detail forced, the end of the page had an unpainted rectangle
  above the footer with the page text drawn over it. Its height equalled the
  visible height of the footer. Every capture taken with solid covers showed
  it: four on four earlier builds, and one of a later build served with the
  two values made solid. None of the three captures taken with these colours
  did, including one of that same later build and one of the final build.
- **Why, as far as it was established.** Chromium's software compositor draws
  a WebGL canvas by flipping it about its full height, and applies that flip
  to the rectangle it still considers visible as well as to the pixels
  (`SoftwareRenderer::DrawTextureQuad`, read from Chromium's main branch on
  2026-11-13, not from the exact browser build used here, and not confirmed
  with a debugger). When an opaque layer hides the lower part of the canvas,
  the remaining upper rectangle is painted in the mirrored, lower position
  and the top is left empty. The measured geometry matches that exactly. A
  cover that is not fully opaque is never treated as hiding what is under
  it, so the canvas is always drawn whole.
- **What was not established.** Which page state makes the footer hide the
  canvas in this way. The fault followed the whole walk down the page. It did
  not follow a jump straight to the end, at either level of detail, with the
  footer forced onto its own layer or with content animating just before it.
- **Reach.** That code is the path Chromium uses when it composites without a
  GPU, so GPU-accelerated browsers are not expected to be affected. On an
  Intel Arc GPU, one walk at 1024 px wide with solid covers ended with the
  sampled area above the footer painted. A phone-width run on a GPU could
  not be made.
- **Cost.** At most one step in 255 per colour channel where bright field
  pixels sit under a cover.
- **No automated guard.** The Chromium suite checks on-screen colours above
  the footer at the test browser's default detail, where solid covers pass
  too. Do not make a full-width cover solid without repeating the
  full-detail, phone-width walk in a browser that composites in software.

## D010 - A key or pointer press ends an eased wheel scroll

The mouse wheel is eased in script: each frame sets the scroll position a
little closer to where the wheel asked for. A scroll that the browser starts
in between is cancelled by the next such step. An in-page link pressed during
a glide therefore did nothing (4 of 4 in a probe, and the Chromium case for
it failed 3 of 3 before this change).

- The glide now stops at the first key or pointer press, and whatever the
  visitor did takes over from where the page is.
- Keys are included by reasoning, not by reproduction. A link activated from
  the keyboard and focus moving to a control off screen scroll the way a
  pressed link does. Scroll keys themselves were not cancelled in the probe;
  they added to the glide.
- Cost: a scroll key pressed during a glide acts from the current position,
  not from where the glide was heading.

## Coding conventions

- UTF-8, LF, ASCII unless a concrete product need requires otherwise.
- Java: records for small immutable contracts, Bean Validation, constructor
  injection, explicit errors, Google Java Format through Spotless.
- TypeScript: strict mode, unknown data validated at the fetch boundary, no
  unchecked `any`, no ignored promises, minimal React components.
- SQL: numbered Flyway migrations, parameterized queries, no runtime
  schema-auto-update or automatic destructive rollback.
- Formatting: Prettier for supported repository text and Spotless for Java.
- Tests: fast deterministic unit tests; separate real-service smoke tests.
- Scripts: project-local paths, checked exit codes, no broad error suppression,
  no global environment mutation, no automatic destructive cleanup.
- CI: manually triggered definition only; the same local check command is the
  required gate. A CI configuration file is not evidence of a successful run.
