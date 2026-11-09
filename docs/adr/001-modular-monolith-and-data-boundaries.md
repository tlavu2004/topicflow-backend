# ADR-001: Modular monolith and data boundaries

- Status: Accepted
- Date: 2026-10-30
- Story: TFL-1

## Context

TopicFlow has one backend process and one PostgreSQL database. RSS ingestion, topic matching, and the user feed share data, but splitting them into services would add deployment and consistency work before there is a scaling need.

## Decision

- Use Nest modules for `identity`, `source`, `topic`, `crawler`, `article`, and `matching` in one process. Shared HTTP/configuration infrastructure lives outside those domain modules.
- Each module owns writes to its tables. This is a code convention because all modules share one `PrismaClient`; the database does not enforce module ownership. Only repository classes of the owning module may inject `PrismaService` to write those tables. Controllers and application services use repositories or the owning module's exported application service. Exports stay narrow.
- The `article` feed is a read model: it may perform **read-only** joins across article, topic, match, user-source, and read-state tables. This avoids per-row queries and does not transfer write ownership. The read query will be measured with PostgreSQL `EXPLAIN` in TFL-11.
- Matching stores topic/article associations regardless of a user's current source selection. The feed filters by `user_source` at read time. Deselecting a source hides its articles immediately; selecting it again can reveal existing matches without rematching. This trades some retained associations for simpler, stable matching semantics.
- Pure text normalization and matching rules must not import NestJS or Prisma. The crawler may use a stronger ports/adapters boundary when its network and persistence logic arrives; simple CRUD modules need no extra layers.
- JavaScript/TypeScript import checks can enforce package direction, but they do not inspect SQL joins or prove table write ownership. TFL-2's first repository adds a scoped ESLint `no-restricted-imports` rule: controllers and application services may not import `PrismaService` or the generated Prisma Client directly; database infrastructure, repository classes, and tests are explicit exceptions. Extend the rule to later modules and review actual queries and exports in each PR. Empty TFL-1 domain modules did not justify a vacuous check.

## Public module contracts (TFL-2 follow-up)

- Every domain module has one TypeScript entry point, `src/modules/<name>/index.ts`. Other modules and the application composition root import only that entry point. A module uses direct relative imports internally to avoid barrel cycles. Tests may inspect internals.
- TypeScript exports describe the supported contracts; Nest `exports` describe injectable capabilities. Review both. Never export repositories, Prisma models, HTTP DTOs, or the full authentication workflow to another module merely to make dependency injection work.
- Identity publicly supplies `IdentityModule`, `AccessTokenGuard`, `IdentityAccessService` and the authenticated request type. `IdentityAccessService` validates access tokens and returns a principal containing a decimal-string user ID. Registration, login, refresh rotation, JWT refresh verification and persistence stay private. Consumers import `IdentityModule` in their Nest module and use its guard or access service; they do not redeclare identity providers.
- Shared database/config/HTTP infrastructure has no imports from domain modules. Infrastructure owns connection lifecycle, not business writes. Domain database imports are permitted only in repositories and module composition files; services, controllers and guards use repositories or public capabilities.
- `DatabaseModule` registers and exports the single `PrismaService` provider. Domain modules import it instead of registering their own client/pool. Repositories inject the shared provider; shutdown hooks allow Nest to disconnect it during application termination. Application contracts use plain TypeScript types; HTTP validation, Swagger metadata and response serialization remain at the controller/DTO boundary. Identity's password and token implementation services are private providers, not public module exports.
- Business transactions stay inside the module that owns the write. Call another module's public operation outside that transaction; there is no shared Prisma transaction passed between modules. Do not add cross-module transactions or events without defining their consistency and failure semantics in an ADR.
- Dependency direction follows the blueprint's ownership table. An import of a Nest module is wiring, not permission to access its tables. No cyclic domain dependencies. Source/topic user IDs come from the authenticated principal; they do not need to load identity's user repository.
- Enforce public-entry imports and database access with a local ESLint rule, including type imports, re-exports, literal dynamic imports and `require`. Tests are exempt from encapsulation so integration tests can inspect persistence. SQL ownership, Nest export lists and architectural cycles still require review. Existing feed joins remain the explicit read-only exception.
- Keep simple modules flat while they are small; the entry point and ownership contract establish encapsulation. Introduce internal application/domain/infrastructure directories when complexity warrants them. There is one deployable backend and one migration history; this is not a conversion to microservices or mandatory hexagonal layers.

## Migration review rule

The Prisma schema and the migration SQL committed with each story are reviewed together. Handwritten SQL is allowed for PostgreSQL features or atomic statements Prisma cannot express; it must be parameterized in application code and covered by a PostgreSQL integration test before merge. Never edit a migration already applied in a shared environment; add a new migration. TFL-1's empty baseline records the starting schema without creating a fake application table.

## Consequences

The feed can make one optimized query across module tables while write responsibilities remain clear. A future read model or service split would need explicit ownership and synchronization rules. The decision to retain matches after source deselection will be revisited only if measured storage or reconciliation cost makes it necessary.
