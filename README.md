# Trade Copier — Monorepo

Cloud-hosted MT5 trade copier with real-time risk-aware execution, recovery, and SaaS-ready architecture.

## Repository Structure

```
/
├── apps/
│   ├── web/          # Next.js 15 Dashboard (TypeScript)
│   └── api/          # NestJS Backend (TypeScript)
├── packages/
│   ├── shared-types/ # Zod schemas + TypeScript types shared across apps
│   ├── database/     # Prisma schema + migrations
│   └── config/       # Shared ESLint, Prettier, TSConfig
├── mt5/
│   ├── master-ea/    # MQL5 Master EA
│   ├── sub-ea/       # MQL5 Sub EA
│   └── include/      # Shared MQL5 headers
├── docs/             # Architecture documentation
└── poc/              # Communication POC (archived)
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Initialize database
pnpm db:generate
pnpm db:migrate

# Create owner account (first-time setup only)
pnpm init:owner

# Start development servers
pnpm dev
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Database Schema](./docs/database.md)
- [API Reference](./docs/api.md)
- [MT5 Integration](./docs/mt5-integration.md)
- [Risk Engine](./docs/risk-engine.md)
- [Deployment](./docs/deployment.md)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript |
| Database | Supabase (PostgreSQL) + Prisma ORM |
| Real-time | Socket.io |
| MT5 | MQL5 Expert Advisors |
| Payments | Flutterwave (Phase 11) |

## Project Status

- **Phase 2 (Master EA & API):** COMPLETE
- **Phase 3 (Risk Engine):** COMPLETE
- **Phase 4 (Sub EA & Execution Pipeline):** COMPLETE & FROZEN
