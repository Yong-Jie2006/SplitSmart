import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** A person who participates in this single SplitSmart group. */
export const people = pgTable("people", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** An amount paid by one person, stored in whole sen/cents. */
export const expenses = pgTable(
  "expenses",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
