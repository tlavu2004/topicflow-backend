# Running TopicFlow

Run commands from the repository root. The backend currently runs on Node.js; Compose runs PostgreSQL only. There is no backend Dockerfile yet.

## Requirements

- Node.js 24.22.2 (see `.nvmrc`) and npm 11.11.1.
- Docker Desktop with the Linux engine running, or a working Docker Engine with Compose.
- Free local ports 3000 (backend) and 5432 (PostgreSQL).

## First-time local setup

The commands below use PowerShell.

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.local.example .env.local }
npm run infra:up
npm run db:validate
npm run db:generate
npm run db:deploy
npm run start:dev
```

The local template includes disposable development credentials. Keep `DATABASE_URL` aligned with `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`. The backend runs on your host, so its database URL uses `localhost`. Changing the template does not change your existing `.env.local`.

Open [Health](http://localhost:3000/health), [Swagger UI](http://localhost:3000/docs) or [OpenAPI JSON](http://localhost:3000/docs/json). Health is a process-liveness check, not a database-readiness check. Use Swagger to register, log in and call `/me` with the access token.

For subsequent runs, start Docker Desktop, run `npm run infra:up`, apply any new migrations with `npm run db:deploy`, then run `npm run start:dev`. Regenerate Prisma Client after schema changes or updating Prisma dependencies.

## Migrating from the old `.env`

If you already configured `.env`, preserve its values by copying it only when `.env.local` does not exist:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env .env.local }
```

Check that `.env.local` contains `NODE_ENV=development`, `DATABASE_URL`, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Compare the variable names with `.env.local.example`. Both signing keys must be distinct and at least 32 bytes. The app and Prisma CLI no longer read `.env`; `.env.test` and `.env.production` are not loaded either. Keep private files out of Git.

## Environment selection and precedence

| Execution                      | Source                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Development app and Prisma CLI | Exported environment first, then `.env.local` for missing values                          |
| Automated tests                | Synthetic values from `test/setup-env.ts`; Testcontainers supplies the integration DB URL |
| CI                             | Workflow environment and test setup; local files are skipped when `CI=true`               |
| Production app and Prisma CLI  | Hosting/process environment only; set `NODE_ENV=production` externally                    |

The default mode is `development`. A local file cannot switch the process to test or production. An exported empty value still takes precedence and may fail validation; remove stale shell overrides if the local file appears to be ignored. Run from the repository root so both Nest and Prisma resolve the same local file.

Use `npm run infra:*` commands for local infrastructure. They select `--env-file .env.local` explicitly, with shell variables taking precedence. Bare `docker compose` can still auto-read a legacy `.env` under Docker's own rules and should not be used for this setup. Compose's env-file option supplies interpolation values; it does not automatically inject every variable into containers. Only the configured PostgreSQL variables are passed to the database service.

## Build and run compiled code

```powershell
npm run db:generate
npm run build
npm run start:prod
```

`start:prod` runs compiled JavaScript; its name does not set `NODE_ENV`. In a development shell it still uses `.env.local`. To run with production behavior, configure the environment first:

```powershell
$env:NODE_ENV = 'production'
# Supply DATABASE_URL and both JWT secrets through your hosting/secrets system.
npm run db:deploy
npm run start:prod
```

Use `.env.production.example` as a list of required hosting variables. Do not copy local credentials into production. Generate two independent signing keys with this command, executed separately for each key:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store the output privately in the hosting environment. Production disables Swagger. Supply the database provider's required TLS parameters in `DATABASE_URL`; migrations use the same URL selection as the app. Database CLI commands require the database URL, while starting the application also validates JWT secrets. Building/generating is normally done before deployment in CI.

To return a PowerShell session to local defaults, remove production overrides you previously set, including `NODE_ENV`, `DATABASE_URL`, `PORT` and JWT keys as applicable. For example, `Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue` removes the runtime-mode override.

## Run checks

```powershell
npm run build
npm run lint
npm run test:architecture
npm run test:ci-tools
npm run test:unit
npm run test:e2e -- --runInBand
npm run test:integration
```

Unit and HTTP smoke tests do not need a database or `.env.local`. Integration tests require Docker, start disposable PostgreSQL 17 with a dynamic port, apply committed migrations and stop the container after the suite. They do not use or reset your Compose database. No `.env.test` or test Compose stack is required. Prisma's Jest integration script enables Node VM modules; the experimental warning is expected.

Reports are written to ignored `test-results/<profile>/`. CI uploads allowlisted diagnostics only on failure, retained for three days. See the README for the report contents and CI jobs.

## Inspect and stop infrastructure

```powershell
npm run infra:ps
npm run infra:logs
```

Press Ctrl+C to stop log following or the backend. Then stop the local database:

```powershell
npm run infra:down
```

PostgreSQL data remains in `.local/postgres-data`. Changing `POSTGRES_*` in an env file does not update users/passwords in an already initialized database. Preserve existing credentials or deliberately migrate the database configuration; do not delete the data directory to fix a configuration typo.

## Troubleshooting

- **Docker connection / container-runtime errors:** start Docker Desktop, wait for its Linux engine, then retry `npm run infra:up` or integration tests.
- **Missing environment variable:** check the selected runtime mode and `.env.local` filename. Production/CI never load local files. Ensure both JWT keys exist when starting the backend.
- **Authentication or connection failure:** check exported overrides, URL credentials, port, and whether PostgreSQL was initialized with different credentials. Never paste full connection strings into logs or issues.
- **Port already in use:** stop the conflicting service. To change the local database host port, update Compose's mapping and `DATABASE_URL` together. Change `PORT` for the backend separately.
- **Missing generated Prisma Client:** run `npm run db:generate`, then rebuild.
- **Missing tables:** run `npm run db:deploy` against the intended database. Use committed migrations; do not edit already-applied migration files.
- **Schema change during development:** create a migration with `npx prisma migrate dev --create-only --name <change>`, review its SQL, run `npx prisma migrate dev`, then regenerate the client.
