# AI log

- The initial dashboard API exposed independently fetched top-level fields; it was changed to one snapshot-backed `dashboard` query.
- Balance calculations originally fetched people and expenses independently; they now use the same rows used for the expense list.
- The dashboard transaction uses repeatable-read isolation so concurrent writes cannot mix old and new data in one response.
- Database `CHECK` constraints now reject non-positive expenses and negative participant shares, even if application validation is bypassed.
- Browser tests must use a separate database; the Playwright configuration refuses to start without `DATABASE_URL_TEST`.
- The settlement algorithm is exact but may need a group-size limit before the app supports larger groups.
- Drizzle generated required session columns immediately, which would fail on populated tables; the migration was reordered to backfill a Default session before applying `NOT NULL`.
- A one-off GraphQL smoke command did not load `.env`; it was rerun with the environment file explicitly instead of weakening the app's required `DATABASE_URL` check.
- The original browser test was coupled to a native session select; it now verifies the visible sidebar item, active state, and session heading instead.
