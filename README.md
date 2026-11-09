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

Controllers and application services use repositories; ESLint rejects direct database/Prisma imports in those files. SQL-specific features can be added to reviewed Prisma migration SQL. Use `prisma migrate dev --create-only --name <change>` locally, review the SQL, then `prisma migrate dev` and `npm run db:generate`. Deploy committed migrations with `npm run db:deploy`; do not edit applied migrations.

## Checks

```powershell
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:integration
npm run lint
docker compose config
```

Stop the local database with `docker compose down` when you are finished; the bind-mounted data on drive D is retained.

The Swagger UI and OpenAPI JSON are enabled outside production. `/health` is a process liveness check; database readiness and application features will be added in their stories.

CI runs build, lint, Prisma schema validation, and unit/HTTP smoke tests on Node 24.22.2. `test:integration` requires Docker, starts disposable PostgreSQL 17, applies committed migrations, and tests registration, password verification, JWT boundaries, refresh concurrency, logout, BIGINT serialization and throttling. Its reusable helper is in `test/helpers/postgres.ts`. Prisma's runtime uses dynamic imports, so this Jest script enables Node VM modules. Adding this database suite to CI remains TFL-3.
