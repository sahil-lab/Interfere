# Threat model and safety boundaries

## Assets and trust boundaries

Current assets are source code, a local database password, a synthetic fixture,
and developer-machine resources. Future user telemetry, traces, source
repositories, and patch credentials must not be introduced implicitly.

Boundaries: browser -> loopback web proxy -> API -> internal PostgreSQL;
dependency registries -> bounded build containers; operator -> Compose.
There is no cloud, Git, agent, production, or third-party telemetry boundary
in the implemented slice.

## Threats and controls

| Threat                                    | Phase 0/1 control                                                                                                               | Residual limitation                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Accidental real-data collection           | No telemetry endpoint/SDK; only one allowlisted synthetic fixture; no request-body logging                                      | Future collection requires explicit consent, schemas, redaction tests, and retention design            |
| Credentials exposed in files/logs         | Runtime password generated into ignored `.env`; no fixed shared password; sanitized errors/logs; build contexts exclude secrets | Local operator/Docker administrators can access the local environment file                             |
| SQL injection or unexpected input         | Bean Validation, exact fixture allowlist, parameterized JDBC, strict unknown-property rejection                                 | Future endpoints need their own validation and permissions                                             |
| Misleading success when storage fails     | Readiness includes DB; database access errors are 503; UI reports fetch/contract failures                                       | Full outage/retry/chaos matrix is deferred to Phase 5                                                  |
| Exposing a development API to the network | Only loopback ports; DB unpublished on an internal-only network; no CORS enablement                                             | No authentication yet; untrusted local users are not isolated; web/API bridge permits outbound traffic |
| Browser injection/framing                 | React text rendering, same-origin assets/API, CSP, no external fonts/scripts, anti-framing and content-type headers             | Not a completed security audit or production-hardening claim                                           |
| Resource contention with other sessions   | Compose project `interfere`, fixed exclusive ports, bounded CPU/memory/PIDs/logs, sequential builders                           | Image downloads and Docker's shared build daemon still share host resources                            |
| Destructive repair or arbitrary execution | No agent, shell execution API, patch endpoint, repository mount, or Docker socket                                               | Later repair workers require isolated sandboxes and explicit review boundaries                         |
| Cross-project damage                      | Source mounts restricted to this project; no prune/reset/remove-volume scripts; stop targets only `interfere`                   | Operator must not reuse another project's name or data volume                                          |
| Supply-chain drift                        | Exact npm versions and lockfile; pinned Spring Boot; supported runtime families; runtime digests recorded when verified         | Container patch-family tags remain mutable; registry provenance is not independently audited           |

## Approval boundaries

- No real user data, production access, cloud spending/provisioning, autonomous
  production modification, repository credentials, commits, remotes, or pushes.
- Git initialization was **not authorized** for this project and is not done.
- No seeded bugs, telemetry ingestion, reproduction execution, or agent
  integration is included in Phase 1.
- Any future telemetry requires explicit informed consent and redaction of PII
  and credentials before transmission or persistence.
- Any future patch requires human review; generating a proposal never authorizes
  applying it, opening a remote PR, merging it, or deploying it.
- Destructive cleanup, schema rollback, or data-volume removal requires separate
  approval. None is part of the startup/check workflow.

## Verification boundaries

Unit and smoke tests cover invalid requests, non-echoed rejected values,
server-generated request IDs, real DB-backed success, and disabled capabilities.
These checks are not a penetration test and do not establish production safety.
Load limits, sophisticated denial-of-service protection, authentication,
telemetry redaction, and agent sandboxing remain explicitly unimplemented.
