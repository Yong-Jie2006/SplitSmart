export type BalancePresentation = {
  wording: string;
  tone: "receivable" | "payable" | "settled";
};

export function presentBalance(amountCents: number, formattedAmount: string): BalancePresentation {
  if (amountCents > 0) {
    return { wording: `gets back ${formattedAmount}`, tone: "receivable" };
  }

  if (amountCents < 0) {
    return { wording: `owes ${formattedAmount}`, tone: "payable" };
  }

  return { wording: "settled", tone: "settled" };
}
