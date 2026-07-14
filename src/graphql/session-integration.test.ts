import { graphql, type ExecutionResult } from "graphql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.DATABASE_URL_TEST;

describe.skipIf(!testDatabaseUrl)("expense session GraphQL integration", () => {
  let database: typeof import("@/db");
  let schema: typeof import("@/graphql/schema").schema;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    database = await import("@/db");
    ({ schema } = await import("@/graphql/schema"));

    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(database.db, { migrationsFolder: "drizzle" });
  });

  beforeEach(async () => {
    const { expenseSessions, expenses, people } = await import("@/db/schema");
    await database.db.transaction(async (tx) => {
      await tx.delete(expenses);
      await tx.delete(people);
      await tx.delete(expenseSessions);
      await tx.insert(expenseSessions).values({ name: "Default session" });
    });
  });

  afterAll(async () => {
    await database?.sql.end();
  });

  it("creates a session and exposes data stored in the Default session", async () => {
    const created = await execute(`
      mutation CreateSession($name: String!) {
        createSession(name: $name) { id name createdAt }
      }
    `, { name: "Bali Trip" });
    expect(created.data?.createSession).toMatchObject({ name: "Bali Trip" });

    const sessions = await execute(`
      query Sessions { sessions { id name createdAt } }
    `);
    expect(sessions.data?.sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Default session" }),
      expect.objectContaining({ name: "Bali Trip" }),
    ]));

    const defaultSession = (sessions.data?.sessions as SessionResult[]).find(
      (session) => session.name === "Default session",
    )!;
    await addPerson(defaultSession.id, "Existing person");
    const dashboard = await getDashboard(defaultSession.id);
    expect(dashboard.people).toEqual([
      expect.objectContaining({ name: "Existing person" }),
    ]);
  });

  it("isolates people, expenses, balances, settlements, and deletion by session", async () => {
    const baliId = await createSession("Bali Trip");
    const dinnerId = await createSession("Weekend Dinner");
    const [aliId, sitiId, kumarId] = await Promise.all([
      addPerson(baliId, "Ali"),
      addPerson(baliId, "Siti"),
      addPerson(baliId, "Kumar"),
    ]);
    const [meiId, rajId] = await Promise.all([
      addPerson(dinnerId, "Mei"),
      addPerson(dinnerId, "Raj"),
    ]);

    const baliExpenseId = await addExpense(baliId, {
      description: "Hotel",
      amountCents: 9_000,
      paidByPersonId: aliId,
      participantIds: [aliId, sitiId, kumarId],
    });
    const baliBeforeDinner = await getDashboard(baliId);

    await addExpense(dinnerId, {
      description: "Dinner",
      amountCents: 4_001,
      paidByPersonId: meiId,
      participantIds: [meiId, rajId],
    });

    const bali = await getDashboard(baliId);
    const dinner = await getDashboard(dinnerId);
    expect(bali).toEqual(baliBeforeDinner);
    expect(bali.people.map((person) => person.name)).toEqual(["Ali", "Siti", "Kumar"]);
    expect(bali.expenses.map((expense) => expense.description)).toEqual(["Hotel"]);
    expect(dinner.people.map((person) => person.name)).toEqual(["Mei", "Raj"]);
    expect(dinner.expenses.map((expense) => expense.description)).toEqual(["Dinner"]);

    for (const dashboard of [bali, dinner]) {
      expect(dashboard.balances.reduce((sum, balance) => sum + balance.amountCents, 0)).toBe(0);
      expect(applySettlements(dashboard)).toEqual(
        dashboard.balances.map((balance) => [balance.person.id, 0]),
      );
    }

    await execute(`
      mutation DeleteExpense($sessionId: ID!, $id: ID!) {
        deleteExpense(sessionId: $sessionId, id: $id) { id }
      }
    `, { sessionId: baliId, id: baliExpenseId });
    expect((await getDashboard(baliId)).expenses).toEqual([]);
    expect((await getDashboard(dinnerId)).expenses).toHaveLength(1);
  });

  it("rejects cross-session payers, participants, and expense deletion", async () => {
    const sessionA = await createSession("Session A");
    const sessionB = await createSession("Session B");
    const personA = await addPerson(sessionA, "A");
    const personB = await addPerson(sessionB, "B");

    for (const input of [
      { paidByPersonId: personB, participantIds: [personA] },
      { paidByPersonId: personA, participantIds: [personB] },
    ]) {
      const result = await execute(`
        mutation AddExpense($sessionId: ID!, $input: AddExpenseInput!) {
          addExpense(sessionId: $sessionId, input: $input) { id }
        }
      `, {
        sessionId: sessionA,
        input: { description: "Invalid", amountCents: 100, ...input },
      });
      expect(result.errors?.[0].extensions.code).toBe("BAD_USER_INPUT");
    }

    const expenseB = await addExpense(sessionB, {
      description: "B only",
      amountCents: 100,
      paidByPersonId: personB,
      participantIds: [personB],
    });
    const deletion = await execute(`
      mutation DeleteExpense($sessionId: ID!, $id: ID!) {
        deleteExpense(sessionId: $sessionId, id: $id) { id }
      }
    `, { sessionId: sessionA, id: expenseB });
    expect(deletion.errors?.[0].extensions.code).toBe("BAD_USER_INPUT");
    expect((await getDashboard(sessionB)).expenses).toHaveLength(1);
  });

  async function execute(
    source: string,
    variableValues?: Record<string, unknown>,
  ): Promise<ExecutionResult<Record<string, unknown>>> {
    return graphql({ schema, source, variableValues }) as Promise<ExecutionResult<Record<string, unknown>>>;
  }

  async function createSession(name: string): Promise<string> {
    const result = await execute(`
      mutation CreateSession($name: String!) {
        createSession(name: $name) { id }
      }
    `, { name });
    expect(result.errors).toBeUndefined();
    return (result.data?.createSession as { id: string }).id;
  }

  async function addPerson(sessionId: string, name: string): Promise<string> {
    const result = await execute(`
      mutation AddPerson($sessionId: ID!, $name: String!) {
        addPerson(sessionId: $sessionId, name: $name) { id }
      }
    `, { sessionId, name });
    expect(result.errors).toBeUndefined();
    return (result.data?.addPerson as { id: string }).id;
  }

  async function addExpense(sessionId: string, input: AddExpenseVariables): Promise<string> {
    const result = await execute(`
      mutation AddExpense($sessionId: ID!, $input: AddExpenseInput!) {
        addExpense(sessionId: $sessionId, input: $input) { id }
      }
    `, { sessionId, input });
    expect(result.errors).toBeUndefined();
    return (result.data?.addExpense as { id: string }).id;
  }

  async function getDashboard(sessionId: string): Promise<DashboardResult> {
    const result = await execute(`
      query Dashboard($sessionId: ID!) {
        dashboard(sessionId: $sessionId) {
          people { id name }
          expenses { id description amountCents }
          balances { person { id name } amountCents }
          settlements { from { id } to { id } amountCents }
        }
      }
    `, { sessionId });
    expect(result.errors).toBeUndefined();
    return result.data?.dashboard as DashboardResult;
  }
});

type SessionResult = { id: string; name: string };
type AddExpenseVariables = {
  description: string;
  amountCents: number;
  paidByPersonId: string;
  participantIds: string[];
};
type DashboardResult = {
  people: Array<{ id: string; name: string }>;
  expenses: Array<{ id: string; description: string; amountCents: number }>;
  balances: Array<{ person: { id: string; name: string }; amountCents: number }>;
  settlements: Array<{ from: { id: string }; to: { id: string }; amountCents: number }>;
};

function applySettlements(dashboard: DashboardResult): Array<[string, number]> {
  const balances = new Map(
    dashboard.balances.map((balance) => [balance.person.id, balance.amountCents]),
  );

  for (const settlement of dashboard.settlements) {
    balances.set(settlement.from.id, balances.get(settlement.from.id)! + settlement.amountCents);
    balances.set(settlement.to.id, balances.get(settlement.to.id)! - settlement.amountCents);
  }

  return dashboard.balances.map((balance) => [balance.person.id, balances.get(balance.person.id)!]);
}
