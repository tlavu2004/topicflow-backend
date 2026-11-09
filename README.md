# TopicFlow backend

NestJS backend for the TopicFlow RSS and topic feed app. The implementation plan is in [the current blueprint](docs/blueprints/topicflow-blueprint.md); the preserved Spring/MySQL plan is in [the previous blueprint](docs/blueprints/topicflow-blueprint-v1.md).

## Baseline

| Component                      | Version / choice                      |
| ------------------------------ | ------------------------------------- |
| Node.js                        | 24.22.2                               |
| npm                            | 11.11.1                               |
| NestJS core / Express adapter  | 11.2.8                                |
| NestJS Swagger / JWT           | 11.4.7 / 11.0.2                       |
| TypeScript                     | 5.9.3, CommonJS output                |
| Prisma Client / Migrate        | 7.10.1                                |
| Prisma PostgreSQL adapter / pg | 7.10.1 / 8.16.3                       |
| PostgreSQL                     | 17 via Docker Compose                 |
| HTTP tests                     | Jest 30 + ts-jest 29.4.15 + Supertest |
| PostgreSQL Testcontainers      | 12.2.1                                |
| Future Docker base (TFL-19)    | `node:24.22.2-bookworm-slim`          |
| Deployment runtime (TFL-19)    | Render Docker web service             |

`package.json` declares `type: commonjs`. The Nest CLI uses TypeScript `module: nodenext`; with this package type, the emitted application JavaScript is CommonJS. Prisma Client explicitly uses `moduleFormat = "cjs"` to match it.

Node 24 satisfies the package engine requirements of Nest 11, Prisma 7, Jest 30, and Testcontainers 12. The Swagger/JWT smoke test and generated Prisma Client build verify the selected combination. No compatibility fallback was needed. The Docker base tag is published; the image build and Render deployment are work for TFL-19.

## Local setup

1. Use Node.js 24.22.2 (`.nvmrc`). Run `npm ci` from this repository on drive D.
2. Copy `.env.example` to `.env`. The example values are **local development only**; set production credentials separately.
3. Start Docker Desktop, then run `docker compose up -d` from this repository. PostgreSQL data binds to `.local/postgres-data` on drive D and is ignored by Git.
4. Run `npm run db:validate`, `npm run db:generate`, and `npm run db:deploy`.
5. Run `npm run start:dev`. Open `http://localhost:3000/health`, `http://localhost:3000/docs`, or `http://localhost:3000/docs/json`.

The schema includes `users` and `refresh_sessions`. Review the Prisma schema and SQL migration together. See [ADR-001](docs/adr/001-modular-monolith-and-data-boundaries.md) for the handwritten SQL review rule and module boundaries.

`NODE_ENV=development` is the local default. Production uses `NODE_ENV=production`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and optional `PORT` (default 3000); startup validates these values, and production ignores local `.env` files. JWT secrets must be distinct, at least 32 bytes, and randomly generated for deployment; example secrets are local-only. Add both JWT variables from `.env.example` to an existing local `.env`. Errors use `application/problem+json`, and DTO input is validated globally. PostgreSQL `BIGINT` IDs remain **positive decimal strings** at the API boundary; reuse the TFL-1 helper and never serialize a JavaScript `bigint` directly to JSON.

## Authentication (TFL-2)

| Endpoint              | Input / authorization                  | Result                                                      |
| --------------------- | -------------------------------------- | ----------------------------------------------------------- |
| `POST /auth/register` | JSON `email`, `password`               | 201 user (`id`, `email`)                                    |
| `POST /auth/login`    | JSON `email`, `password`               | 200 `accessToken`, `refreshToken`, `tokenType`, `expiresIn` |
| `GET /me`             | `Authorization: Bearer <accessToken>`  | 200 current user                                            |
| `POST /auth/refresh`  | `Authorization: Bearer <refreshToken>` | 200 rotated token pair                                      |
| `POST /auth/logout`   | `Authorization: Bearer <refreshToken>` | 204; revokes that refresh session                           |

Email is trimmed and lowercased by application policy, with a unique database constraint. Passwords are 12–128 characters, never trimmed, and hashed using Argon2id (19 MiB, two iterations, parallelism one, random salt). Benchmark these settings on the deployment tier before increasing costs.

Access tokens expire after 15 minutes; refresh tokens after seven days. Both are JWTs with separate signing keys, HS256, issuer/audience and token-purpose validation. Tokens are returned in the login/refresh JSON response and supplied through request headers, never query parameters or cookies. Token responses use `Cache-Control: no-store`.

Only SHA-256 hashes of high-entropy refresh tokens are persisted. Rotation atomically consumes the old session and creates its replacement; concurrent refreshes have one winner. Replayed/expired/revoked refresh tokens return 401. Logout revokes only the supplied session, and **existing access tokens remain valid until expiry**. Replay detection does not revoke the replacement session or other devices. Expired sessions cannot refresh; periodic deletion of expired rows is deferred maintenance. `/me` derives ownership from the verified subject; resource-specific ownership checks arrive with their modules.

Register and login share a limit of 10 requests per minute per IP, including invalid requests. This in-memory limiter resets on restart, is independent per instance, and caps tracked IPs at 10,000. Express proxy trust is not enabled: behind a reverse proxy the visible IP may be shared. Configure trusted proxy hops and a shared limiter when deploying multiple instances. The limiter is a basic abuse control, not a distributed lockout system.

Controllers and application services use repositories. ESLint checks domain encapsulation across all production TypeScript files: other modules import only `src/modules/<name>/index.ts`, shared infrastructure cannot import domains, and only repositories/module wiring may import database infrastructure. Tests may inspect internals. `npm run test:architecture` verifies the rule against allowed imports and forbidden static, type, re-export, dynamic and CommonJS imports. SQL write ownership and cyclic domain dependencies still require review. See [ADR-001](docs/adr/001-modular-monolith-and-data-boundaries.md).

For another domain to authenticate a request, import `IdentityModule` in its Nest module, then use `AccessTokenGuard` or inject `IdentityAccessService`, all from `src/modules/identity`. The service exposes only `authenticateAccessToken(token)`, returning `{ userId: string }`; it does not expose registration, refresh or database operations. The guard supplies `AuthenticatedRequest.userId` as a `bigint` for internal queries. Serialize it through the shared decimal-ID helper for HTTP responses. Resource ownership remains the responsibility of the consuming module. An integration-test consumer verifies the exported guard and service work without redeclaring identity providers.

Domain modules needing persistence import `DatabaseModule` from `src/database/database.module.ts`; do not add `PrismaService` to each module's providers. This shares one client/pool per application context. Only repositories inject it for queries. Nest shutdown hooks close the client on application termination. Identity keeps plain application contracts in `auth.types.ts`, HTTP DTOs/serialization in its controller boundary, and private `PasswordService`/`TokenService` providers for cryptography. The public access service depends only on token verification, while `AuthService` coordinates users and refresh-session persistence.

SQL-specific features can be added to reviewed Prisma migration SQL. Use `prisma migrate dev --create-only --name <change>` locally, review the SQL, then `prisma migrate dev` and `npm run db:generate`. Deploy committed migrations with `npm run db:deploy`; do not edit applied migrations.

## Checks

```powershell
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:integration
npm run lint
npm run test:architecture
npm run test:ci-tools
docker compose config
```

Stop the local database with `docker compose down` when you are finished; the bind-mounted data on drive D is retained.

The Swagger UI and OpenAPI JSON are enabled outside production. `/health` is a process liveness check; database readiness and application features will be added in their stories.

## CI and test profiles (TFL-3)

| Profile              | Command                           | Discovery                  | Database                            |
| -------------------- | --------------------------------- | -------------------------- | ----------------------------------- |
| Unit                 | `npm run test:unit`               | `src/**/*.spec.ts`         | None                                |
| HTTP smoke/e2e       | `npm run test:e2e -- --runInBand` | `test/**/*.e2e-spec.ts`    | None                                |
| Database integration | `npm run test:integration`        | `**/*.integration-spec.ts` | Disposable PostgreSQL 17 via Docker |

`npm test` remains the unit-test entry point. CI adds `--ci` to all three profiles. Run `npm run db:generate` before testing a fresh checkout. HTTP smoke tests compile the app but do not issue database queries. Integration tests run serially, use the reusable `test/helpers/postgres.ts`, apply committed migrations before creating the app and stop the container after the suite. Migration execution has a 60-second timeout; Jest integration tests have a 120-second timeout. Prisma's runtime uses dynamic imports, so the integration script enables Node VM modules. No Compose database, real data or repository secrets are needed.

`.github/workflows/ci.yml` runs on pushes, PRs targeting `main`, and manual dispatch. Two independent jobs run on Ubuntu/Node 24.22.2:

- **Application checks and unit/HTTP tests:** clean install, Prisma validation/generation, build, lint, architecture checks, diagnostics-tool tests, then unit and HTTP tests. HTTP tests also run after a unit-test failure.
- **PostgreSQL integration tests:** clean install, generate Prisma Client, verify Docker, then run migrations and database tests through Testcontainers. GitHub-hosted Ubuntu runners provide Docker; there is no separate PostgreSQL service or shared database.

Each job has a 15-minute timeout. New runs cancel older runs for the same event/ref; push and PR runs do not cancel one another. Workflow permissions are `contents: read`.

The custom Jest reporter writes ignored `test-results/<profile>/report.json` and `execution.log`. Reports include suite paths relative to that profile's Jest root, assertion line numbers/status/duration and counts. Database setup adds `integration/postgres.log` with startup/migration phase outcomes. Failure artifacts are named `application-test-diagnostics` and `postgres-integration-diagnostics`, retained for three days, and upload only these explicitly listed files. If installation or configuration fails before tests start, there may be no report; inspect the failed Actions step.

Artifacts deliberately omit raw failure messages, test titles, console output, environment dumps, `.env`, DB contents, passwords, connection strings and JWTs. Use the corresponding Actions test step for detailed assertion output; never add real credentials/data to tests. `npm run test:ci-tools` checks reporter failure output with a synthetic secret and verifies the artifact excludes it. Successful runs keep reports locally but do not upload failure artifacts. Release/container publishing, coverage thresholds and OpenAPI snapshot gates remain outside TFL-3.
