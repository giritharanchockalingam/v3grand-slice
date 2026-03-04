# Contributing to V3 Grand

Thank you for your interest in contributing to the V3 Grand Investment Platform slice.

## Development setup

1. **Prerequisites**: Node.js ≥ 20, pnpm ≥ 8, Docker (for PostgreSQL + Redis).
2. **Clone and install**:
   ```bash
   git clone <repo-url>
   cd v3grand-slice
   pnpm install
   ```
3. **Environment**: Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and `NEXT_PUBLIC_API_URL` as needed.
4. **Infrastructure**: From repo root, `cd packages/infra && docker compose up -d`.
5. **Database**: `pnpm --filter @v3grand/db run seed`.
6. **Run**: API on port 3001 (`pnpm --filter @v3grand/api dev`), UI on port 3000 (`pnpm --filter @v3grand/ui dev`).

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for detailed runbook and demo credentials.

## Project structure

- **packages/core** — Shared TypeScript types, Zod schemas, logger. No runtime deps beyond Zod.
- **packages/engines** — Pure computation (Factor, Underwriter, Monte Carlo, Budget, S-Curve, Decision). Depends only on `@v3grand/core`.
- **packages/db** — Drizzle schema, queries, seed. Depends on `@v3grand/core`.
- **packages/api** — Fastify server, routes, recompute service. Depends on core, engines, db.
- **packages/ui** — Next.js 14 App Router UI. Depends on `@v3grand/core`.
- **packages/infra** — Docker Compose for local Postgres + Redis.

## Code standards

- **TypeScript**: Strict mode. Prefer types from `@v3grand/core`; avoid `any`.
- **Formatting**: Use the project’s existing style; run `pnpm lint` and `pnpm typecheck` from the root.
- **Tests**: Engine logic lives in `packages/engines`; add or extend Vitest tests there. Run with `pnpm test`.
- **Commits**: Clear, concise messages. Reference issues/PRs where relevant.

## Pull requests

1. Branch from `main`/`master`.
2. Keep changes focused; split large work into smaller PRs.
3. Ensure `pnpm build`, `pnpm typecheck`, and `pnpm test` pass.
4. Update documentation under `docs/` if behavior or setup changes.

## Documentation

- **README.md** — Overview, quick start, architecture, and references.
- **docs/RUNBOOK.md** — Operational runbook and demo walkthroughs.
- **docs/GAP_ANALYSIS.md** — Spec vs implementation gap analysis.

If you have questions, open an issue or discussion in the repository.
