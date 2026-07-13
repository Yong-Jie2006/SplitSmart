import { describe, expect, it } from "vitest";

import {
  calculateBalances,
  calculateSettlements,
  splitEqually,
  type Balance,
  type Settlement,
} from "@/lib/money";

describe("splitEqually", () => {
  it("splits an evenly divisible amount", () => {
    expect(splitEqually(9000, [1, 2, 3])).toEqual([
      { personId: 1, amountCents: 3000 },
      { personId: 2, amountCents: 3000 },
      { personId: 3, amountCents: 3000 },
    ]);
  });

  it("assigns remainder cents deterministically without changing the total", () => {
    const shares = splitEqually(1000, [3, 1, 2]);

    expect(shares).toEqual([
      { personId: 3, amountCents: 334 },
      { personId: 1, amountCents: 333 },
      { personId: 2, amountCents: 333 },
    ]);
    expect(shares.reduce((total, share) => total + share.amountCents, 0)).toBe(1000);
  });

  it("rejects an invalid amount or participant list", () => {
    expect(() => splitEqually(0, [1])).toThrow();
    expect(() => splitEqually(100, [])).toThrow();
    expect(() => splitEqually(100, [1, 1])).toThrow();
  });
});

describe("calculateBalances", () => {
  it("calculates each person's net balance for one shared expense", () => {
    const balances = calculateBalances([1, 2, 3], [
      {
        amountCents: 9000,
        paidByPersonId: 1,
        shares: splitEqually(9000, [1, 2, 3]),
      },
    ]);

    expect(balances).toEqual([
      { personId: 1, amountCents: 6000 },
      { personId: 2, amountCents: -3000 },
      { personId: 3, amountCents: -3000 },
    ]);
    expect(totalBalances(balances)).toBe(0);
  });

  it("combines multiple expenses and keeps totals at zero", () => {
    const balances = calculateBalances([1, 2, 3], [
      {
        amountCents: 300,
        paidByPersonId: 1,
        shares: splitEqually(300, [1, 2, 3]),
      },
      {
        amountCents: 600,
        paidByPersonId: 2,
        shares: splitEqually(600, [2, 3]),
      },
    ]);

    expect(balances).toEqual([
      { personId: 1, amountCents: 200 },
      { personId: 2, amountCents: 200 },
      { personId: 3, amountCents: -400 },
    ]);
    expect(totalBalances(balances)).toBe(0);
  });

  it("rejects stored shares that do not match the expense total", () => {
    expect(() =>
      calculateBalances([1, 2], [
        {
          amountCents: 1000,
          paidByPersonId: 1,
          shares: [{ personId: 1, amountCents: 999 }],
        },
      ]),
    ).toThrow("Expense shares must add up exactly to the expense amount.");
  });
});

describe("calculateSettlements", () => {
  it("settles a simple shared expense", () => {
    const settlements = calculateSettlements([
      { personId: 1, amountCents: 6000 },
      { personId: 2, amountCents: -3000 },
      { personId: 3, amountCents: -3000 },
    ]);

    expect(settlements).toEqual([
      { fromPersonId: 2, toPersonId: 1, amountCents: 3000 },
      { fromPersonId: 3, toPersonId: 1, amountCents: 3000 },
    ]);
    expect(applySettlementsToBalances(settlements, [
      { personId: 1, amountCents: 6000 },
      { personId: 2, amountCents: -3000 },
      { personId: 3, amountCents: -3000 },
    ])).toEqual([
      { personId: 1, amountCents: 0 },
      { personId: 2, amountCents: 0 },
      { personId: 3, amountCents: 0 },
    ]);
  });

  it("settles uneven cent amounts exactly", () => {
    const balances = [
      { personId: 1, amountCents: 334 },
      { personId: 2, amountCents: -167 },
      { personId: 3, amountCents: -167 },
    ];

    expect(calculateSettlements(balances)).toEqual([
      { fromPersonId: 2, toPersonId: 1, amountCents: 167 },
      { fromPersonId: 3, toPersonId: 1, amountCents: 167 },
    ]);
  });

  it("returns the minimum number of payments rather than a greedy extra payment", () => {
    const balances = [
      { personId: 1, amountCents: -600 },
      { personId: 2, amountCents: -400 },
      { personId: 3, amountCents: -400 },
      { personId: 4, amountCents: 800 },
      { personId: 5, amountCents: 600 },
    ];
    const settlements = calculateSettlements(balances);

    expect(settlements).toHaveLength(3);
    expect(applySettlementsToBalances(settlements, balances)).toEqual(
      balances.map(({ personId }) => ({ personId, amountCents: 0 })),
    );
  });

  it("returns no payments when everyone is already settled", () => {
    expect(calculateSettlements([
      { personId: 1, amountCents: 0 },
      { personId: 2, amountCents: 0 },
    ])).toEqual([]);
  });

  it("rejects balances that do not sum to zero", () => {
    expect(() =>
      calculateSettlements([
        { personId: 1, amountCents: 100 },
        { personId: 2, amountCents: -99 },
      ]),
    ).toThrow("Balances must sum to zero before settling up.");
  });
});

function totalBalances(balances: readonly Balance[]): number {
  return balances.reduce((total, balance) => total + balance.amountCents, 0);
}

function applySettlementsToBalances(
  settlements: readonly Settlement[],
  balances: readonly Balance[],
): Balance[] {
  const remaining = new Map(
    balances.map((balance) => [balance.personId, balance.amountCents]),
  );

  for (const settlement of settlements) {
    remaining.set(
      settlement.fromPersonId,
      remaining.get(settlement.fromPersonId)! + settlement.amountCents,
    );
    remaining.set(
      settlement.toPersonId,
      remaining.get(settlement.toPersonId)! - settlement.amountCents,
    );
  }

  return balances.map(({ personId }) => ({
    personId,
    amountCents: remaining.get(personId)!,
  }));
}
