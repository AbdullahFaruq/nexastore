# NexaStore

A store management and financial analytics app. Read `README.md` for setup and
`docs/ARCHITECTURE.md` for why things are built the way they are.

## Before changing anything financial

- Money is stored as **integer minor units**. Never introduce a float.
- `computeSaleTotals()` is the only place a sale total is calculated. Do not
  add a second one.
- Revenue **excludes tax**. Tax is a liability, not income.
- Cost of goods is snapshotted on `SaleItem` at the moment of sale and must
  never be re-read from the product.
- Run `npm run check` before considering a change done. It covers typecheck,
  lint, the pricing and timezone maths, the source guards, the transactional
  write paths, onboarding, and every analytics pipeline.

## Client/server boundary

A `"use client"` file must not import a value from anything that reaches
Mongoose - it pulls the driver into the browser bundle and Turbopack's error
does not name the offending import. Pure data lives in `lib/db/models/enums.ts`,
`lib/inventory/status.ts`, `lib/analytics/expense-meta.ts`,
`lib/analytics/segments.ts` and `lib/sales/pricing.ts`.
`npm run check:source` enforces this.

## Design

Tokens are in `src/app/globals.css`; the rationale is in `docs/DESIGN.md`. The
chart palette is validated for colour-vision deficiency in both themes - do not
hand-edit `--s1` .. `--s8` without re-running the validator.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
