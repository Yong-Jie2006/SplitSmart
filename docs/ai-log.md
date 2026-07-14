# AI log

- The initial dashboard API exposed independently fetched top-level fields; it was changed to one snapshot-backed `dashboard` query.
- Balance calculations originally fetched people and expenses independently; they now use the same rows used for the expense list.
- The dashboard transaction uses repeatable-read isolation so concurrent writes cannot mix old and new data in one response.
- Database `CHECK` constraints now reject non-positive expenses and negative participant shares, even if application validation is bypassed.
- Browser tests must use a separate database; the Playwright configuration refuses to start without `DATABASE_URL_TEST`.
- The settlement algorithm is exact but may need a group-size limit before the app supports larger groups.
- Expense amount parsing errors were initially routed through the page-level alert; they are now field-scoped, associated with the input, and focused after an invalid submission.
- The Phase 1 browser run could not start because `DATABASE_URL_TEST` is absent; the test remains isolated rather than falling back to and resetting the application database.
