# V3 Grand — Pilot Runbook

## Prerequisites

| Tool       | Version   |
|------------|-----------|
| Node.js    | ≥ 20 LTS  |
| pnpm       | ≥ 8       |
| PostgreSQL | ≥ 15      |

## Quick Start (fresh machine)

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and edit if needed (defaults work on macOS with Homebrew PG)
cp .env.example .env

# 3. Create database + seed
pnpm --filter @v3grand/db run seed
#    Creates "v3grand" DB, all tables, demo users, V3 Grand deal, construction
#    data, risk register entries, and initial engine results.

# 4. Start API server (port 3001)
pnpm --filter @v3grand/api run dev

# 5. Start UI (port 3000) — in a separate terminal
pnpm --filter @v3grand/ui run dev

# 6. Open http://localhost:3000/login
```

## Demo Credentials

| Email               | Password | Role            |
|---------------------|----------|-----------------|
| lead@v3grand.com    | demo123  | lead-investor   |
| co@v3grand.com      | demo123  | co-investor     |
| ops@v3grand.com     | demo123  | operator        |
| viewer@v3grand.com  | demo123  | viewer          |
| lp1@v3grand.com     | demo123  | co-investor     |
| lp2@v3grand.com     | demo123  | viewer          |

## Demo Walkthroughs

### 1. Investor Dashboard Flow (lead@ or co@)
1. Login → Deals list → click **V3 Grand Madurai Hotel**
2. **Dashboard tab** → view Recommendation Card, Key Metrics, 10-Year Pro Forma
3. Click **▶ Recompute Recommendation** → watch engine cascade run → metrics refresh
4. Note the toast confirmation banner at the top

### 2. Assumption Sensitivity (lead@)
1. Go to **Assumptions tab**
2. Drag "ADR Growth Rate" slider up to 8%
3. Click **Save & Recompute** → IRR/NPV update, verdict may flip
4. Try adjusting "Exit Multiple" and "Debt Ratio" — observe impact on recommendation

### 3. Scenario Comparison (any role)
1. Go to **Scenarios tab**
2. Compare Bear / Base / Bull side-by-side: IRR, NPV, Equity Multiple, Gate results
3. Click "Promote to Active" on Bull scenario → badge moves
4. Year-by-year revenue/EBITDA comparison table at the bottom

### 4. Construction Monitoring (ops@ or lead@)
1. Go to **Construction tab** (only visible to lead-investor, operator, co-investor)
2. View budget lines, milestones, existing change orders
3. Submit a new change order → appears with status "submitted"
4. Login as lead@ → approve the CO → triggers recompute with updated budget

### 5. Risk Register (any role with edit access)
1. Go to **Risks tab**
2. View summary strip: Total / Open / High Priority
3. Click "+ Add Risk" → fill form → Save
4. Mark existing risks as Mitigated / Accepted / Closed

## Re-Seeding

To reset the database and start fresh:

```bash
# Drop and recreate
psql -c "DROP DATABASE IF EXISTS v3grand"
pnpm --filter @v3grand/db run seed
```

## Project Structure

```
packages/
  core/     — Types, schemas, logger (shared)
  engines/  — Pure computation (Factor, Underwriter, MC, Budget, S-Curve, Decision)
  db/       — Drizzle schema, queries, seed
  api/      — Fastify server, routes, recompute service
  ui/       — Next.js 14 App Router frontend
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED :5432` | Start PostgreSQL: `brew services start postgresql@15` |
| `database "v3grand" does not exist` | Run `pnpm --filter @v3grand/db run seed` |
| API CORS errors | Check `NEXT_PUBLIC_API_URL` in `.env` matches API port |
| "No access to this deal" | Run seed to create deal_access entries |
| Blank dashboard after seed | Click "Recompute" to generate initial engine results |
