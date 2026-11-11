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
