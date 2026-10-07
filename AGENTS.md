# Repository Guidelines

## Project Structure & Module Organization

NexaStore is a Next.js App Router application using TypeScript, Tailwind CSS, Radix UI, Clerk, and MongoDB/Mongoose.

- `src/app/(marketing)`, `(auth)`, and `(app)` contain landing, authentication, and store routes.
- `src/components/` contains shared UI primitives and feature components; `src/hooks/` contains client hooks.
- `src/actions/` contains server actions. `src/lib/` contains authentication, database models, analytics, validation, and financial logic.
- `scripts/check-*.ts` contains automated checks; `public/` is the static asset directory.
- Read `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, and `CLAUDE.md` before changing relevant behavior.

## Build, Test, and Development Commands

- `npm ci`: install locked dependencies.
- `npm run dev`: start local development at `http://localhost:3000`.
- `npm run build` / `npm run start`: build and serve production output.
- `npm run typecheck` / `npm run lint`: check strict TypeScript and Next.js ESLint rules.
- `npm run check`: run typecheck, lint, math, source-boundary, write-flow, onboarding, and analytics checks.
- `npm run seed`: populate demo data for local analytics checks.

## Coding Style & Naming Conventions

Match existing two-space indentation, double quotes, and semicolons. Use PascalCase component names, camelCase functions, kebab-case module filenames, and `@/` imports for `src/`. Follow App Router filenames such as `page.tsx` and `layout.tsx`.

Prefer Server Components; add `"use client"` only where needed. Client modules must not import values that transitively reach Mongoose. Reuse existing UI primitives and Brass design tokens in `src/app/globals.css`. Preserve responsive layouts, semantic markup, keyboard access, and visible focus. Consult installed Next.js guides in `node_modules/next/dist/docs/` for version-specific APIs.

## Testing Guidelines

Checks use `tsx`, Node assertions, and custom integration scripts; no dedicated test framework or coverage threshold is configured. Extend relevant `scripts/check-*.ts` checks with descriptive assertions. Run `npm run check` before submitting. Database checks require configured MongoDB; analytics checks use seeded data. Use a development database. Visually verify UI changes on desktop and mobile.

## Commit & Pull Request Guidelines

History contains only the initial Create Next App commit; no established convention exists. Use concise, imperative commit subjects. Keep PRs focused; describe behavior changes, link relevant issues, list validation results, and include screenshots for UI changes.

## Security & Financial Invariants

Configure `.env.local` using `.env.example`; never commit secrets. Store money as integer minor units, use `computeSaleTotals()` for sale totals, exclude tax from revenue, and preserve sale-time cost snapshots. Never enable development authentication in production.
