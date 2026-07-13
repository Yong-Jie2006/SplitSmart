export type PersonId = number;

export type ExpenseShare = {
  personId: PersonId;
  amountCents: number;
};

export type ExpenseForBalance = {
  amountCents: number;
  paidByPersonId: PersonId;
  shares: readonly ExpenseShare[];
};

export type Balance = {
  personId: PersonId;
  amountCents: number;
};

export type Settlement = {
  fromPersonId: PersonId;
  toPersonId: PersonId;
  amountCents: number;
};

/**
 * Splits a positive amount of cents equally. Remainder cents are assigned in
 * participant order, making the result exact and repeatable.
 */
export function splitEqually(
  amountCents: number,
  participantIds: readonly PersonId[],
): ExpenseShare[] {
  assertPositiveSafeInteger(amountCents, "amountCents");
  assertUniquePersonIds(participantIds, "participantIds");

  if (participantIds.length === 0) {
    throw new Error("An expense must have at least one participant.");
  }

  const baseShareCents = Math.floor(amountCents / participantIds.length);
  const remainderCents = amountCents % participantIds.length;

  return participantIds.map((personId, index) => ({
    personId,
    amountCents: baseShareCents + (index < remainderCents ? 1 : 0),
  }));
}

/**
 * Calculates how much each person should receive (positive) or pay (negative).
 * The returned balances always total zero when the expense data is valid.
 */
export function calculateBalances(
  personIds: readonly PersonId[],
  expenses: readonly ExpenseForBalance[],
): Balance[] {
  assertUniquePersonIds(personIds, "personIds");

  const balances = new Map<PersonId, number>(
    personIds.map((personId) => [personId, 0]),
  );

  for (const expense of expenses) {
    assertPositiveSafeInteger(expense.amountCents, "expense.amountCents");

    if (!balances.has(expense.paidByPersonId)) {
      throw new Error("Every expense payer must be in personIds.");
    }

    assertUniquePersonIds(
      expense.shares.map((share) => share.personId),
      "expense share personIds",
    );

    const totalShares = expense.shares.reduce((total, share) => {
      assertNonNegativeSafeInteger(share.amountCents, "share.amountCents");

      if (!balances.has(share.personId)) {
        throw new Error("Every expense participant must be in personIds.");
      }

      return total + share.amountCents;
    }, 0);

    if (totalShares !== expense.amountCents) {
      throw new Error("Expense shares must add up exactly to the expense amount.");
    }

    balances.set(
      expense.paidByPersonId,
      balances.get(expense.paidByPersonId)! + expense.amountCents,
    );

    for (const share of expense.shares) {
      balances.set(share.personId, balances.get(share.personId)! - share.amountCents);
    }
  }

  return personIds.map((personId) => ({
    personId,
    amountCents: balances.get(personId)!,
  }));
}

/**
 * Finds the fewest payments that settle every balance. A positive balance means
 * the person receives money; a negative balance means they pay money.
 */
export function calculateSettlements(
  balances: readonly Balance[],
): Settlement[] {
  assertUniquePersonIds(
    balances.map((balance) => balance.personId),
    "balance personIds",
  );

  const amounts = balances.map((balance) => {
    assertSafeInteger(balance.amountCents, "balance.amountCents");
    return balance.amountCents;
  });

  if (amounts.reduce((total, amount) => total + amount, 0) !== 0) {
    throw new Error("Balances must sum to zero before settling up.");
  }

  const memo = new Map<string, Settlement[]>();

  function solve(state: readonly number[]): Settlement[] {
    const key = state.join(",");
    const cached = memo.get(key);
    if (cached) {
      return cached;
    }

    const sourceIndex = state.findIndex((amountCents) => amountCents !== 0);
    if (sourceIndex === -1) {
      return [];
    }

    let best: Settlement[] | undefined;
    const triedCounterpartyAmounts = new Set<number>();

    for (let counterpartyIndex = sourceIndex + 1; counterpartyIndex < state.length; counterpartyIndex += 1) {
      const sourceAmount = state[sourceIndex];
      const counterpartyAmount = state[counterpartyIndex];

      if (sourceAmount * counterpartyAmount >= 0) {
        continue;
      }

      // Equivalent counterparties produce equivalent remaining states. Skipping
      // them keeps the exact search practical without changing its result.
      if (triedCounterpartyAmounts.has(counterpartyAmount)) {
        continue;
      }
      triedCounterpartyAmounts.add(counterpartyAmount);

      const paymentCents = Math.min(
        Math.abs(sourceAmount),
        Math.abs(counterpartyAmount),
      );
      const nextState = [...state];

      let payment: Settlement;
      if (sourceAmount < 0) {
        nextState[sourceIndex] += paymentCents;
        nextState[counterpartyIndex] -= paymentCents;
        payment = {
          fromPersonId: balances[sourceIndex].personId,
          toPersonId: balances[counterpartyIndex].personId,
          amountCents: paymentCents,
        };
      } else {
        nextState[sourceIndex] -= paymentCents;
        nextState[counterpartyIndex] += paymentCents;
        payment = {
          fromPersonId: balances[counterpartyIndex].personId,
          toPersonId: balances[sourceIndex].personId,
          amountCents: paymentCents,
        };
      }

      const candidate = [payment, ...solve(nextState)];
      if (!best || candidate.length < best.length) {
        best = candidate;
      }
    }

    if (!best) {
      throw new Error("Unable to settle balances.");
    }

    memo.set(key, best);
    return best;
  }

  return solve(amounts);
}

function assertUniquePersonIds(
  personIds: readonly PersonId[],
  fieldName: string,
): void {
  for (const personId of personIds) {
    assertPositiveSafeInteger(personId, fieldName);
  }

  if (new Set(personIds).size !== personIds.length) {
    throw new Error(`${fieldName} must not contain duplicates.`);
  }
}

function assertPositiveSafeInteger(value: number, fieldName: string): void {
  assertSafeInteger(value, fieldName);

  if (value <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }
}

function assertNonNegativeSafeInteger(value: number, fieldName: string): void {
  assertSafeInteger(value, fieldName);

  if (value < 0) {
    throw new Error(`${fieldName} must not be negative.`);
  }
}

function assertSafeInteger(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${fieldName} must be a safe integer number of cents.`);
  }
}
