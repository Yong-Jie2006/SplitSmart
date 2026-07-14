import { describe, expect, it } from "vitest";

import { presentBalance } from "./balance-presentation";

describe("presentBalance", () => {
  it("describes a positive balance as money the person gets back", () => {
    expect(presentBalance(12_345, "RM 123.45")).toEqual({
      wording: "gets back RM 123.45",
      tone: "receivable",
    });
  });

  it("describes a negative balance as money the person owes", () => {
    expect(presentBalance(-12_345, "RM 123.45")).toEqual({
      wording: "owes RM 123.45",
      tone: "payable",
    });
  });

  it("describes a zero balance as settled", () => {
    expect(presentBalance(0, "RM 0.00")).toEqual({
      wording: "settled",
      tone: "settled",
    });
  });
});
