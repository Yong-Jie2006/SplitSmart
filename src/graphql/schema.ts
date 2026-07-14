import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import { z } from "zod";

import { db } from "@/db";
import {
  expenseParticipants,
  expenseSessions,
  expenses,
  people,
} from "@/db/schema";
import {
  calculateBalances,
  calculateSettlements,
  splitEqually,
  type ExpenseShare,
} from "@/lib/money";

const typeDefs = /* GraphQL */ `
  type ExpenseSession {
    id: ID!
    name: String!
    createdAt: String!
    updatedAt: String!
  }

  type Person {
    id: ID!
    name: String!
    createdAt: String!
  }

  type ExpenseShare {
    person: Person!
    amountCents: Int!
  }

  type Expense {
    id: ID!
    description: String!
    amountCents: Int!
    paidBy: Person!
    createdAt: String!
    shares: [ExpenseShare!]!
  }

  type Balance {
    person: Person!
    amountCents: Int!
  }

  type Settlement {
    from: Person!
    to: Person!
    amountCents: Int!
  }

  type DeletedExpense {
    id: ID!
  }

  type Dashboard {
    people: [Person!]!
    expenses: [Expense!]!
    balances: [Balance!]!
    settlements: [Settlement!]!
  }

  input AddExpenseInput {
    description: String!
    amountCents: Int!
    paidByPersonId: ID!
    participantIds: [ID!]!
  }

  type Query {
    sessions: [ExpenseSession!]!
    dashboard(sessionId: ID!): Dashboard!
  }

  type Mutation {
    createSession(name: String!): ExpenseSession!
    addPerson(sessionId: ID!, name: String!): Person!
    addExpense(sessionId: ID!, input: AddExpenseInput!): Expense!
    deleteExpense(sessionId: ID!, id: ID!): DeletedExpense!
  }
`;

const nameInput = z.object({
  name: z.string().trim().min(1).max(100),
});

const recordId = z.coerce.number().int().positive();

const sessionInput = z.object({
  sessionId: recordId,
});

const addPersonInput = sessionInput.extend(nameInput.shape);

const addExpenseInput = z.object({
  description: z.string().trim().min(1).max(200),
  amountCents: z.number().int().positive(),
  paidByPersonId: recordId,
  participantIds: z
    .array(recordId)
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Each participant can appear only once.",
    }),
});

type PersonRecord = {
  id: number;
  name: string;
  createdAt: Date;
};

type ExpenseRecord = {
  id: number;
  description: string;
  amountCents: number;
  paidBy: PersonRecord;
  createdAt: string;
  shares: Array<{ person: PersonRecord; amountCents: number }>;
};

type DashboardRecord = {
  people: PersonRecord[];
  expenses: ExpenseRecord[];
  balances: Array<{ person: PersonRecord; amountCents: number }>;
  settlements: Array<{
    from: PersonRecord;
    to: PersonRecord;
    amountCents: number;
  }>;
};

export const schema = createSchema({
  typeDefs,
  resolvers: {
    Query: {
      sessions: async () => {
        const rows = await db
          .select()
          .from(expenseSessions)
          .orderBy(
            desc(expenseSessions.updatedAt),
            desc(expenseSessions.createdAt),
            desc(expenseSessions.id),
          );

        return rows.map(toSessionRecord);
      },
      dashboard: (_parent, args: { sessionId: unknown }) =>
        getDashboard(parseInput(recordId, args.sessionId)),
    },
    Mutation: {
      createSession: async (_parent, args: { name: unknown }) => {
        const input = parseInput(nameInput, args);
        const [session] = await db
          .insert(expenseSessions)
          .values({ name: input.name })
          .returning();

        return toSessionRecord(session);
      },
      addPerson: async (_parent, args: { sessionId: unknown; name: unknown }) => {
        const input = parseInput(addPersonInput, args);
        return db.transaction(async (tx) => {
          await requireSession(tx, input.sessionId);
          const [person] = await tx
            .insert(people)
            .values({ sessionId: input.sessionId, name: input.name })
            .returning();
          await tx
            .update(expenseSessions)
            .set({ updatedAt: sql`now()` })
            .where(eq(expenseSessions.id, input.sessionId));

          return person;
        });
      },
      addExpense: async (_parent, args: { sessionId: unknown; input: unknown }) => {
        const { sessionId } = parseInput(sessionInput, args);
        const input = parseInput(addExpenseInput, args.input);
        await requireSession(db, sessionId);
        const requestedPersonIds = [
          input.paidByPersonId,
          ...input.participantIds,
        ];
        const personRows = await db
          .select()
          .from(people)
          .where(and(
            eq(people.sessionId, sessionId),
            inArray(people.id, requestedPersonIds),
          ));

        if (personRows.length !== new Set(requestedPersonIds).size) {
          throw userInputError("The payer and every participant must belong to the selected session.");
        }

        const peopleById = new Map(personRows.map((person) => [person.id, person]));
        const shares = splitEqually(input.amountCents, input.participantIds);

        const [expense] = await db.transaction(async (tx) => {
          const [createdExpense] = await tx
            .insert(expenses)
            .values({
              sessionId,
              description: input.description,
              amountCents: input.amountCents,
              paidByPersonId: input.paidByPersonId,
            })
            .returning();

          await tx.insert(expenseParticipants).values(
            shares.map((share) => ({
              expenseId: createdExpense.id,
              personId: share.personId,
              shareCents: share.amountCents,
            })),
          );
          await tx
            .update(expenseSessions)
            .set({ updatedAt: sql`now()` })
            .where(eq(expenseSessions.id, sessionId));

          return [createdExpense];
        });

        return toExpenseRecord(expense, peopleById, shares);
      },
      deleteExpense: async (_parent, args: { sessionId: unknown; id: unknown }) => {
        const sessionId = parseInput(recordId, args.sessionId);
        const expenseId = parseInput(recordId, args.id);
        return db.transaction(async (tx) => {
          await requireSession(tx, sessionId);
          const [deletedExpense] = await tx
            .delete(expenses)
            .where(and(
              eq(expenses.sessionId, sessionId),
              eq(expenses.id, expenseId),
            ))
            .returning({ id: expenses.id });

          if (!deletedExpense) {
            throw userInputError("Expense not found.");
          }

          await tx
            .update(expenseSessions)
            .set({ updatedAt: sql`now()` })
            .where(eq(expenseSessions.id, sessionId));

          return deletedExpense;
        });
      },
    },
  },
});

async function getDashboard(sessionId: number): Promise<DashboardRecord> {
  return db.transaction(async (tx) => {
    await requireSession(tx, sessionId);
    const [personRows, expenseRows, shareRows] = await Promise.all([
      tx.select().from(people).where(eq(people.sessionId, sessionId)).orderBy(asc(people.id)),
      tx.select().from(expenses).where(eq(expenses.sessionId, sessionId)).orderBy(asc(expenses.id)),
      tx
        .select({
          expenseId: expenseParticipants.expenseId,
          personId: expenseParticipants.personId,
          shareCents: expenseParticipants.shareCents,
        })
        .from(expenseParticipants)
        .innerJoin(expenses, eq(expenseParticipants.expenseId, expenses.id))
        .where(eq(expenses.sessionId, sessionId))
        .orderBy(asc(expenseParticipants.expenseId), asc(expenseParticipants.personId)),
    ]);
    const peopleById = new Map(personRows.map((person) => [person.id, person]));
    const sharesByExpenseId = new Map<number, ExpenseShare[]>();

    for (const share of shareRows) {
      const expenseShares = sharesByExpenseId.get(share.expenseId) ?? [];
      expenseShares.push({
        personId: share.personId,
        amountCents: share.shareCents,
      });
      sharesByExpenseId.set(share.expenseId, expenseShares);
    }

    const expenseRecords = expenseRows.map((expense) =>
      toExpenseRecord(
        expense,
        peopleById,
        sharesByExpenseId.get(expense.id) ?? [],
      ),
    );
    const balances = calculateBalances(
      personRows.map((person) => person.id),
      expenseRecords.map((expense) => ({
        amountCents: expense.amountCents,
        paidByPersonId: expense.paidBy.id,
        shares: expense.shares.map((share) => ({
          personId: share.person.id,
          amountCents: share.amountCents,
        })),
      })),
    ).map((balance) => ({
      person: peopleById.get(balance.personId)!,
      amountCents: balance.amountCents,
    }));
    const settlements = calculateSettlements(
      balances.map((balance) => ({
        personId: balance.person.id,
        amountCents: balance.amountCents,
      })),
    ).map((settlement) => ({
      from: peopleById.get(settlement.fromPersonId)!,
      to: peopleById.get(settlement.toPersonId)!,
      amountCents: settlement.amountCents,
    }));

    return {
      people: personRows,
      expenses: expenseRecords,
      balances,
      settlements,
    };
  }, {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}

function toSessionRecord(session: { id: number; name: string; createdAt: Date; updatedAt: Date }) {
  return {
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

type SessionReader = {
  select: typeof db.select;
};

async function requireSession(reader: SessionReader, sessionId: number): Promise<void> {
  const [session] = await reader
    .select({ id: expenseSessions.id })
    .from(expenseSessions)
    .where(eq(expenseSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw userInputError("Expense session not found.");
  }
}

function toExpenseRecord(
  expense: {
    id: number;
    description: string;
    amountCents: number;
    paidByPersonId: number;
    createdAt: Date;
  },
  peopleById: Map<number, PersonRecord>,
  shares: readonly ExpenseShare[],
): ExpenseRecord {
  const paidBy = peopleById.get(expense.paidByPersonId);
  if (!paidBy) {
    throw new Error("Expense payer is missing from the database.");
  }

  return {
    id: expense.id,
    description: expense.description,
    amountCents: expense.amountCents,
    paidBy,
    // GraphQL exposes this field as String; serialize the database Date
    // explicitly so clients always receive a standards-compliant timestamp.
    createdAt: expense.createdAt.toISOString(),
    shares: shares.map((share) => {
      const person = peopleById.get(share.personId);
      if (!person) {
        throw new Error("Expense participant is missing from the database.");
      }

      return { person, amountCents: share.amountCents };
    }),
  };
}

function parseInput<T>(validator: z.ZodType<T>, input: unknown): T {
  const result = validator.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw userInputError(result.error.issues.map((issue) => issue.message).join(" "));
}

function userInputError(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "BAD_USER_INPUT" },
  });
}
