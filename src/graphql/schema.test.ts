import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const transaction = vi.fn();
  const select = vi.fn();
  const tx = { select };

  return {
    db: { transaction },
    select,
    transaction,
    tx,
  };
});

vi.mock("@/db", () => ({ db: database.db }));

import { schema } from "@/graphql/schema";

describe("dashboard query", () => {
  beforeEach(() => {
    database.transaction.mockReset();
    database.select.mockReset();
  });

  it("reads and derives every dashboard section in one repeatable-read transaction", async () => {
    const rows = [
      [
        { id: 1, name: "Ali", createdAt: new Date("2026-01-01T00:00:00.000Z") },
        { id: 2, name: "Bee", createdAt: new Date("2026-01-02T00:00:00.000Z") },
      ],
      [{
        id: 10,
        description: "Dinner",
        amountCents: 1001,
        paidByPersonId: 1,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      }],
      [
        { expenseId: 10, personId: 1, shareCents: 501 },
        { expenseId: 10, personId: 2, shareCents: 500 },
      ],
    ];
    let selectIndex = 0;

    database.select.mockImplementation(() => ({
      from: () => ({
        orderBy: () => Promise.resolve(rows[selectIndex++]),
      }),
    }));
    database.transaction.mockImplementation(async (callback: (tx: typeof database.tx) => unknown) => callback(database.tx));

    const resolveDashboard = schema.getQueryType()?.getFields().dashboard.resolve;
    if (!resolveDashboard) {
      throw new Error("Dashboard resolver is missing.");
    }

    const dashboard = await resolveDashboard(null, {}, undefined, {} as never);

    expect(dashboard).toMatchObject({
      people: [
        { id: 1, name: "Ali" },
        { id: 2, name: "Bee" },
      ],
      expenses: [{
        id: 10,
        description: "Dinner",
        amountCents: 1001,
        paidBy: { id: 1 },
        shares: [
          { person: { id: 1 }, amountCents: 501 },
          { person: { id: 2 }, amountCents: 500 },
        ],
      }],
      balances: [
        { person: { id: 1 }, amountCents: 500 },
        { person: { id: 2 }, amountCents: -500 },
      ],
      settlements: [{ from: { id: 2 }, to: { id: 1 }, amountCents: 500 }],
    });
    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(database.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
    expect(database.select).toHaveBeenCalledTimes(3);
  });
});
