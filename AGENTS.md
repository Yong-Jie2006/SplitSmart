# SplitSmart - Project Instructions

Build a small, single-group expense-splitter web app ("Splitwise-lite"). Keep
the implementation focused on the core requirements; do not add authentication,
real-payment/bank integrations, or a mobile app.

## Required stack

- TypeScript with Next.js App Router.
- React with shadcn/ui and Tailwind CSS.
- PostgreSQL, accessed exclusively through Drizzle ORM.
- Drizzle Kit for schema migrations.
- Vitest for automated tests.
- Use Zod for request/form validation where appropriate.
- Use the repository's existing package manager (pnpm or npm). The database is
  configured with `DATABASE_URL`; Supabase, if used, is database-only and must
  not use `supabase-js` or its generated API.

## Required functionality

1. People: add and list people in the group.
2. Expenses: record a description, monetary amount, payer, and selected people
   to split with; version 1 splits equally and lists all expenses.
3. Balances: show each person's net balance: total paid minus their share of all
   expenses.
4. Settle up: calculate the minimum set of payments that clears all balances.
5. Persistence: store all data in PostgreSQL through Drizzle so it survives
   refreshes and server restarts.
6. Tests: cover the balance and settle-up logic with Vitest.

## Money and correctness rules

- Store and calculate money in integer minor units (sen) to avoid floating-point
  errors. Format as RM only at the UI boundary.
- For uneven equal splits, distribute remainder sen deterministically so the
  parts total the original amount exactly (for example, RM 10 split three ways).
- Balances must always sum to zero.
- Settlement suggestions must be valid, leave every person at zero after
  application, and use the minimum number of payments.

## Workflow expectations

- Plan before implementing; break changes into small, reviewable pieces.
- Before coding, inspect the relevant local Next.js documentation under
  `node_modules/next/dist/docs/`.
- Review diffs and explain unexpected behavior rather than repeatedly applying
  blind fixes.
- Add tests for uncertain logic and run relevant checks after changes.
- Keep a short project plan, an AI log with 5-10 bullets documenting AI mistakes
  and their fixes, and make focused commits as work progresses.

## Optional scope

Only add extras after the core is complete. Possible extras include multiple
groups, expense editing/deletion, categories and filters, charts, CSV export,
receipt images, activity history, dark mode, and deployment.
