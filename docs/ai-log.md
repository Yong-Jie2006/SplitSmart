# AI log

- The initial dashboard API exposed independently fetched top-level fields; it was changed to one snapshot-backed `dashboard` query.
- Balance calculations originally fetched people and expenses independently; they now use the same rows used for the expense list.
- The dashboard transaction uses repeatable-read isolation so concurrent writes cannot mix old and new data in one response.
- Database `CHECK` constraints now reject non-positive expenses and negative participant shares, even if application validation is bypassed.
- Browser tests must use a separate database; the Playwright configuration refuses to start without `DATABASE_URL_TEST`.
- The expense dialog preview initially ordered shares by the people list, which could disagree with the backend after reselecting a participant; it now preserves the submitted participant order.
- Drizzle generated required session columns immediately, which would fail on populated tables; the migration was reordered to backfill a Default session before applying `NOT NULL`.
- Database integration tests loaded GraphQL through two Vitest module realms and failed before assertions; GraphQL dependencies are now inlined so all 17 tests execute with one schema instance.
- The redesigned settlement row broke a DOM-parent-dependent UAT selector, and session creation exposed an asynchronous URL assertion; the row now has an accessible label and the test waits for URL synchronization.
- A client-only recent-session sort would be lost on refresh; session activity is now persisted in PostgreSQL and returned in deterministic order.
