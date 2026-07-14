import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** An independent ledger containing its own people and expenses. */
export const expenseSessions = pgTable("expense_sessions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A person who participates in one expense session. */
export const people = pgTable(
  "people",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => expenseSessions.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("people_session_id_idx").on(table.sessionId)],
);

/** An amount paid by one person, stored in whole sen/cents. */
export const expenses = pgTable(
  "expenses",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => expenseSessions.id),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    paidByPersonId: integer("paid_by_person_id")
      .notNull()
      .references(() => people.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("expenses_session_id_idx").on(table.sessionId),
    check("expenses_amount_cents_positive", sql`${table.amountCents} > 0`),
  ],
);

/** The exact share assigned to each participant for an expense. */
export const expenseParticipants = pgTable(
  "expense_participants",
  {
    expenseId: integer("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    shareCents: integer("share_cents").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.expenseId, table.personId] }),
    check("expense_participants_share_cents_nonnegative", sql`${table.shareCents} >= 0`),
  ],
);
