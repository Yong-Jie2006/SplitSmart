# SplitSmart project plan

- [x] Model people, expenses, and exact per-person shares in PostgreSQL with Drizzle.
- [x] Add people, record equally split expenses, calculate balances, and suggest settlements.
- [x] Read the dashboard from one repeatable-read database snapshot.
- [x] Add database constraints for positive expense amounts and non-negative shares.
- [x] Add GraphQL/database integration tests and a Playwright end-to-end user flow.
- [x] Add an expense-session model and migrate existing data into a Default session.
- [x] Scope the GraphQL API and correctness checks to a selected session.
- [x] Cover session isolation with API integration tests.
- [x] Add a URL-backed session switcher and new-session dialog.
- [x] Scope every dashboard action and state to the selected session.
- [x] Verify the complete multi-session flow with Playwright and final checks.
- [x] Replace the compact session selector with a responsive sidebar and active-session page heading.
- [x] Order sessions by persisted recent activity and refresh the sidebar after dashboard mutations.
