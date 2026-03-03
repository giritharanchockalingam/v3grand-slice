# V3 Grand — Vertical Slice

**One Deal → Underwriter → Decision → Dashboard.**

This is a thin end-to-end slice of the V3 Grand Investment Platform.
It implements a single vertical path: create a deal, run the Underwriter engine,
get a Recommendation, and display it on the Deal Dashboard.

## What's in the slice

| Package | Contents |
|---------|----------|
| `packages/core` | TypeScript types for Deal, ProForma, Decision, Recommendation, Events |
| `packages/engines` | Underwriter (10-year cash-flow model + IRR/NPV) and Decision (gate logic) |
| `packages/db` | Drizzle ORM schema (4 tables), queries, V3 Grand seed data |
| `packages/api` | Fastify server with 4 routes: GET deal, PATCH assumptions, POST underwrite, GET dashboard |
| `packages/ui` | Next.js 14 Deal Dashboard: RecommendationCard, MetricsStrip, CashFlowTable |
| `packages/infra` | Docker Compose for Postgres + Redis |

## Quick start

```bash
# 1. Install
pnpm install

# 2. Start infra
cd packages/infra && docker compose up -d

# 3. Build (core first, engines depend on it)
pnpm build

# 4. Migrate + seed
pnpm db:migrate
pnpm db:seed

# 5. Start API
pnpm --filter @v3grand/api dev     # http://localhost:3001

# 6. Start UI
pnpm --filter @v3grand/ui dev      # http://localhost:3000
```

## Verified engine output (base scenario)

```
IRR:    19.8%   (vs WACC 13.8%)
NPV:    13.38 Cr
DSCR:   1.98x
Eq Mult: 5.61x
→ Decision: INVEST at high confidence
```
