# ADR-001: Modular monolith and data boundaries

- Status: Accepted
- Date: 2026-10-30
- Story: TFL-1

## Context

TopicFlow has one backend process and one PostgreSQL database. RSS ingestion, topic matching, and the user feed share data, but splitting them into services would add deployment and consistency work before there is a scaling need.

## Decision

- Use Nest modules for `identity`, `source`, `topic`, `crawler`, `article`, and `matching` in one process. Shared HTTP/configuration infrastructure lives outside those domain modules.
- Each module owns writes to its tables. Other modules request changes through the owning module's exported application service. Exports stay narrow.
- The `article` feed is a read model: it may perform **read-only** joins across article, topic, match, user-source, and read-state tables. This avoids per-row queries and does not transfer write ownership. The read query will be measured with PostgreSQL `EXPLAIN` in TFL-11.
- Matching stores topic/article associations regardless of a user's current source selection. The feed filters by `user_source` at read time. Deselecting a source hides its articles immediately; selecting it again can reveal existing matches without rematching. This trades some retained associations for simpler, stable matching semantics.
- Pure text normalization and matching rules must not import NestJS or Prisma. The crawler may use a stronger ports/adapters boundary when its network and persistence logic arrives; simple CRUD modules need no extra layers.
- JavaScript/TypeScript import checks can enforce package direction, but they do not inspect SQL joins. With only empty domain modules in TFL-1, a static boundary check has no useful dependency to protect yet. Add one when the first cross-module call is introduced; until then, review module exports and write ownership in each PR.

## Migration review rule

The Prisma schema and the migration SQL committed with each story are reviewed together. Handwritten SQL is allowed for PostgreSQL features or atomic statements Prisma cannot express; it must be parameterized in application code and covered by a PostgreSQL integration test before merge. Never edit a migration already applied in a shared environment; add a new migration. TFL-1's empty baseline records the starting schema without creating a fake application table.

## Consequences

The feed can make one optimized query across module tables while write responsibilities remain clear. A future read model or service split would need explicit ownership and synchronization rules. The decision to retain matches after source deselection will be revisited only if measured storage or reconciliation cost makes it necessary.
