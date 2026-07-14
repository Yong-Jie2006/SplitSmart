# SplitSmart project plan

- [x] Model people, expenses, and exact per-person shares in PostgreSQL with Drizzle.
- [x] Add people, record equally split expenses, calculate balances, and suggest settlements.
- [x] Read the dashboard from one repeatable-read database snapshot.
- [x] Add database constraints for positive expense amounts and non-negative shares.
- [x] Add GraphQL/database integration tests and a Playwright end-to-end user flow.
- [x] Add an expense-session model and migrate existing data into a Default session.
- [ ] Scope the GraphQL API and correctness checks to a selected session.
- [ ] Cover session isolation with API integration tests.
- [ ] Add a URL-backed session switcher and new-session dialog.
- [ ] Scope every dashboard action and state to the selected session.
- [ ] Verify the complete multi-session flow with Playwright and final checks.
