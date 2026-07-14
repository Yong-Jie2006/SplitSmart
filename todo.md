# SplitSmart UI/UX improvement plan

This plan covers only the three approved UI/UX improvements below. All work must follow [`AGENTS.md`](./AGENTS.md), including the required stack, money rules, testing expectations, local Next.js documentation review, AI log maintenance, and focused commits.

## Scope guardrails

- Keep SplitSmart a small, single-group expense splitter.
- Do not add authentication, real payments, bank integrations, multiple groups, or a mobile app.
- Do not change balance calculations, settlement calculations, database persistence, or the integer-sen money model unless a test proves that an existing defect must be fixed.
- Continue formatting money as RM only at the UI boundary.
- Use the existing Next.js, React, shadcn/ui, Tailwind CSS, Zod, Drizzle, PostgreSQL, Vitest, and npm setup required by `AGENTS.md`.
- Before implementation, inspect the relevant documentation under `node_modules/next/dist/docs/`.
- Keep changes small and reviewable, review each diff, update `docs/ai-log.md` with any mistakes and fixes, and make a focused commit for each completed phase.

## Phase 1 — Contextual validation feedback

### Goal

Make expense-form validation errors visible where the problem occurs, especially on mobile, without forcing the user to find a message at the top of the page.

### Tasks

- [ ] Separate field-validation errors from global server or network errors.
- [ ] Show an invalid amount message directly below the Amount (RM) field.
- [ ] Mark the invalid field with `aria-invalid` and connect it to its message with `aria-describedby`.
- [ ] Move keyboard focus to the first invalid field after submission so the error is immediately announced and visible.
- [ ] Clear or update the field error when the user corrects the value and submits again.
- [ ] Preserve the current accepted amount formats and integer-sen conversion rules.
- [ ] Keep unexpected server or network failures in the global alert area.
- [ ] Add automated coverage for an invalid amount and a corrected resubmission.
- [ ] Verify the behavior at desktop and mobile widths using keyboard and pointer input.

### Phase completion criteria

- An invalid amount cannot fail silently or place its only explanation outside the current viewport.
- The invalid field has a visible error style, accessible error association, and predictable focus behavior.
- A valid correction removes the error and allows the existing expense submission flow to continue.

### Expected result

Users immediately understand why an expense was rejected and what they must fix. Mobile users remain at the relevant field instead of searching the page for feedback, while application-level failures still have a clear global message.

## Phase 2 — First-time onboarding

### Goal

Give a new group one obvious first action and avoid presenting a long page of disabled or irrelevant controls before any people exist.

### Tasks

- [ ] Treat `people.length === 0` as a dedicated first-time state.
- [ ] Make the People section and “Add your first person” action the primary content in that state.
- [ ] Hide or compact the unavailable expense form until at least one person exists.
- [ ] Hide or compact the empty Balances, Settle up, and Expense history sections during first-time onboarding.
- [ ] Include concise guidance explaining that expenses can be recorded after adding someone.
- [ ] Reveal the normal dashboard immediately after the first person is added without requiring a refresh.
- [ ] Preserve the existing add-person behavior, validation, and database persistence.
- [ ] Add automated coverage for the empty state and the transition after adding the first person.
- [ ] Verify that the focused empty state works at desktop and mobile widths and does not introduce layout shift or focus loss that blocks continued use.

### Phase completion criteria

- A brand-new user sees one clear next step rather than a disabled expense form and several empty cards.
- Adding the first person transitions the interface to the standard dashboard successfully.
- Returning users with people already stored continue to see the normal dashboard with no added onboarding interruption.

### Expected result

The initial experience is shorter, clearer, and more welcoming. Users understand that creating the group roster comes first, complete that action quickly, and then move naturally into recording an expense.

## Phase 3 — Plain-language balances

### Goal

Explain each balance in words so users do not need to interpret positive and negative signs or remember a legend.

### Tasks

- [ ] Replace sign-dependent display text with plain-language states:
  - Positive balance: “gets back RM …” or “is owed RM …”.
  - Negative balance: “owes RM …”.
  - Zero balance: “settled”.
- [ ] Remove or rewrite the “Positive means they should receive money” instruction once it is no longer needed.
- [ ] Keep the person’s name and formatted RM amount easy to scan.
- [ ] Retain color as a supporting cue, but ensure the wording communicates the state without relying on color.
- [ ] Preserve the exact underlying balance values and verify that displayed balances still sum to zero.
- [ ] Add or update tests covering positive, negative, and zero presentation states.
- [ ] Check long names and large RM values at desktop and mobile widths for wrapping and alignment.

### Phase completion criteria

- Every balance row is understandable without consulting explanatory copy.
- Positive, negative, and zero balances all have explicit, accessible wording.
- No calculation, settlement, money-formatting, or persistence behavior changes.

### Expected result

Users can scan the balance list and immediately understand who owes money, who should receive money, and who is already settled. The interface becomes clearer for first-time users and remains accurate under the money and correctness rules in `AGENTS.md`.

## Final verification

- [ ] Re-read `AGENTS.md` and confirm the completed diff remains within the approved scope.
- [ ] Run the relevant automated tests, including the new UI behavior coverage.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Exercise empty, invalid-input, populated-balance, and zero-balance states at desktop and mobile widths.
- [ ] Confirm balances still sum to zero and settlement suggestions are unchanged.
- [ ] Review the final diff and document any unexpected behavior and its fix in `docs/ai-log.md`.
- [ ] Complete the work as three focused commits, one per phase.

## Overall expected outcome

SplitSmart keeps its existing scope and core behavior while becoming easier to learn and safer to use: validation appears beside the relevant field, new users receive a focused first step, and balances explain themselves in plain language.
