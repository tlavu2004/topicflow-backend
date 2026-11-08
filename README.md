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
| Testcontainers (TFL-2/3)       | 12.2.1, verified; not installed yet   |
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

The schema currently has no application models. TFL-1 applies an empty Prisma Migrate baseline; the first table migration arrives with TFL-2 (`users`). Review the Prisma schema and SQL migration together. See [ADR-001](docs/adr/001-modular-monolith-and-data-boundaries.md) for the handwritten SQL review rule and module boundaries.

`NODE_ENV=development` is the local default. Production uses `NODE_ENV=production`, `DATABASE_URL`, and optional `PORT` (default 3000); startup validates these values, and production ignores local `.env` files. Provide secrets through the deployment environment. Errors use `application/problem+json`, and DTO input is validated globally. PostgreSQL `BIGINT` IDs and the ID-based feed cursor deliberately remain **positive decimal strings** at the API boundary to exercise the PostgreSQL/JavaScript type boundary; reuse the TFL-1 helper and never serialize a JavaScript `bigint` directly to JSON.

## Checks

```powershell
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run lint
docker compose config
```

Stop the local database with `docker compose down` when you are finished; the bind-mounted data on drive D is retained.

The Swagger UI and OpenAPI JSON are enabled outside production. `/health` is a process liveness check; database readiness and application features will be added in their stories.

CI runs the same build, lint, Prisma schema check, and Nest unit/HTTP smoke tests on Node 24.22.2. PostgreSQL-backed integration tests begin with TFL-3 after the first application migration.
