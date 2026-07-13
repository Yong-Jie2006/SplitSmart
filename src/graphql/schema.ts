import { asc, eq, inArray } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import { z } from "zod";

import { db } from "@/db";
import {
  expenseParticipants,
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

  input AddExpenseInput {
    description: String!
    amountCents: Int!
    paidByPersonId: ID!
    participantIds: [ID!]!
  }

  type Query {
    people: [Person!]!
    expenses: [Expense!]!
    balances: [Balance!]!
    settlements: [Settlement!]!
  }

  type Mutation {
    addPerson(name: String!): Person!
    addExpense(input: AddExpenseInput!): Expense!
    deleteExpense(id: ID!): DeletedExpense!
  }
`;

const addPersonInput = z.object({
  name: z.string().trim().min(1).max(100),
});

const personId = z.coerce.number().int().positive();

const addExpenseInput = z.object({
  description: z.string().trim().min(1).max(200),
  amountCents: z.number().int().positive(),
  paidByPersonId: personId,
  participantIds: z
    .array(personId)
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
  createdAt: Date;
  shares: Array<{ person: PersonRecord; amountCents: number }>;
};

export const schema = createSchema({
  typeDefs,
  resolvers: {
    Query: {
      people: listPeople,
      expenses: listExpenses,
      balances: listBalances,
      settlements: listSettlements,
    },
    Mutation: {
      addPerson: async (_parent, args: { name: unknown }) => {
        const input = parseInput(addPersonInput, args);
        const [person] = await db
          .insert(people)
          .values({ name: input.name })
          .returning();

        return person;
      },
      addExpense: async (_parent, args: { input: unknown }) => {
        const input = parseInput(addExpenseInput, args.input);
        const requestedPersonIds = [
          input.paidByPersonId,
          ...input.participantIds,
        ];
        const personRows = await db
          .select()
          .from(people)
          .where(inArray(people.id, requestedPersonIds));

        if (personRows.length !== new Set(requestedPersonIds).size) {
          throw userInputError("The payer and every participant must exist.");
        }

        const peopleById = new Map(personRows.map((person) => [person.id, person]));
        const shares = splitEqually(input.amountCents, input.participantIds);

        const [expense] = await db.transaction(async (tx) => {
          const [createdExpense] = await tx
            .insert(expenses)
            .values({
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

          return [createdExpense];
        });

        return toExpenseRecord(expense, peopleById, shares);
      },
      deleteExpense: async (_parent, args: { id: unknown }) => {
        const expenseId = parseInput(personId, args.id);
        const [deletedExpense] = await db
          .delete(expenses)
          .where(eq(expenses.id, expenseId))
          .returning({ id: expenses.id });

        if (!deletedExpense) {
          throw userInputError("Expense not found.");
        }

        return deletedExpense;
      },
    },
  },
});

async function listPeople(): Promise<PersonRecord[]> {
  return db.select().from(people).orderBy(asc(people.id));
}

async function listExpenses(): Promise<ExpenseRecord[]> {
  const [personRows, expenseRows, shareRows] = await Promise.all([
    listPeople(),
    db.select().from(expenses).orderBy(asc(expenses.id)),
    db
      .select()
      .from(expenseParticipants)
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

  return expenseRows.map((expense) =>
    toExpenseRecord(
      expense,
      peopleById,
      sharesByExpenseId.get(expense.id) ?? [],
    ),
  );
}

async function listBalances() {
  const [personRows, expenseRecords] = await Promise.all([
    listPeople(),
    listExpenses(),
  ]);
  const peopleById = new Map(personRows.map((person) => [person.id, person]));
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
  );

  return balances.map((balance) => ({
    person: peopleById.get(balance.personId)!,
    amountCents: balance.amountCents,
  }));
}

async function listSettlements() {
  const [personRows, balances] = await Promise.all([listPeople(), listBalances()]);
  const peopleById = new Map(personRows.map((person) => [person.id, person]));
  const settlements = calculateSettlements(
    balances.map((balance) => ({
      personId: balance.person.id,
      amountCents: balance.amountCents,
    })),
  );

  return settlements.map((settlement) => ({
    from: peopleById.get(settlement.fromPersonId)!,
    to: peopleById.get(settlement.toPersonId)!,
    amountCents: settlement.amountCents,
  }));
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
    createdAt: expense.createdAt,
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
