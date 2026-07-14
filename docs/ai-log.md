# AI log

- The initial dashboard API exposed independently fetched top-level fields; it was changed to one snapshot-backed `dashboard` query.
- Balance calculations originally fetched people and expenses independently; they now use the same rows used for the expense list.
- The dashboard transaction uses repeatable-read isolation so concurrent writes cannot mix old and new data in one response.
- Database `CHECK` constraints now reject non-positive expenses and negative participant shares, even if application validation is bypassed.
- Browser tests must use a separate database; the Playwright configuration refuses to start without `DATABASE_URL_TEST`.
- The settlement algorithm is exact but may need a group-size limit before the app supports larger groups.
- Expense amount parsing errors were initially routed through the page-level alert; they are now field-scoped, associated with the input, and focused after an invalid submission.
- Adding browser scenarios made later tests share persisted fixtures; tests now select only their intended participants and delete their own expenses so assertions stay deterministic.
- Read-only visual verification was attempted after the production build, but the in-app browser runtime failed during initialization; responsive Playwright assertions remain at mobile and desktop widths.
- Balance copy now receives an absolute formatted RM value; this avoids accidentally exposing a negative sign alongside the plain-language “owes” wording.
