# SplitSmart

A small single-group expense splitter built with Next.js, GraphQL Yoga, Drizzle ORM, and PostgreSQL. Amounts are stored and calculated as integer sen, then formatted as Malaysian ringgit only in the UI.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Install dependencies with `npm install`.
3. Apply migrations with `npm run db:migrate`.
4. Start the app with `npm run dev`.

## Checks

```bash
npm test
npm run lint
npm run build
```

## Browser tests

Playwright runs against a separate disposable database so it never modifies normal app data.

1. Set `DATABASE_URL_TEST` to a separate PostgreSQL database in `.env`.
2. Run `npm run test:e2e`.

The browser suite applies migrations and clears that test database before starting. Do not point `DATABASE_URL_TEST` at a database containing data you want to keep.
