import { expect, test } from "@playwright/test";

test("records, settles, and deletes an unevenly split expense", async ({ page }) => {
  await page.goto("/");

  for (const name of ["Aisha", "Bee"]) {
    await page.getByLabel("Person name").fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("checkbox", { name })).toBeVisible();
  }

  await page.getByLabel("Description").fill("Dinner");
  await page.getByLabel("Amount (RM)").fill("10.01");
  await page.getByLabel("Paid by").selectOption({ label: "Aisha" });
  await page.getByRole("button", { name: "Add expense" }).click();

  await expect(page.getByRole("heading", { name: "Dinner" })).toBeVisible();
  const settlement = page.getByText("Bee pays Aisha", { exact: true }).locator("..");
  await expect(settlement).toBeVisible();
  await expect(settlement.getByText(/RM\s*5\.00/)).toBeVisible();

  await page.getByRole("button", { name: "Delete Dinner" }).click();
  await page.getByRole("button", { name: "Delete expense" }).click();
  await expect(page.getByText("No expenses recorded yet.")).toBeVisible();
});

test("creates, switches, refreshes, and isolates expense sessions", async ({ page }) => {
  await page.goto("/");

  await createSession(page, "Bali Trip");
  const baliUrl = page.url();
  for (const name of ["Ali", "Siti", "Kumar"]) {
    await addPerson(page, name);
  }
  await addExpense(page, {
    description: "Bali hotel",
    amount: "90.00",
    payer: "Ali",
  });

  const balances = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Balances" }),
  });
  await expect(balanceRow(balances, "Ali")).toContainText(/\+RM\s*60\.00/);
  await expect(balanceRow(balances, "Siti")).toContainText(/-RM\s*30\.00/);
  await expect(balanceRow(balances, "Kumar")).toContainText(/-RM\s*30\.00/);

  await createSession(page, "Weekend Dinner");
  const dinnerUrl = page.url();
  await expect(page.getByText("No people yet. Add the participants for this session to begin.")).toBeVisible();
  for (const name of ["Mei", "Raj"]) {
    await addPerson(page, name);
  }
  await addExpense(page, {
    description: "Weekend meal",
    amount: "40.00",
    payer: "Mei",
  });

  await page.getByLabel("Expense session").selectOption({ label: "Bali Trip" });
  await expect(page).toHaveURL(baliUrl);
  await expect(page.getByRole("heading", { name: "Bali hotel" })).toBeVisible();
  await expect(balanceRow(balances, "Ali")).toContainText(/\+RM\s*60\.00/);

  await page.getByRole("button", { name: "Delete Bali hotel" }).click();
  await page.getByRole("button", { name: "Delete expense" }).click();
  await expect(page.getByText("No expenses recorded yet.")).toBeVisible();

  await page.getByLabel("Expense session").selectOption({ label: "Weekend Dinner" });
  await expect(page).toHaveURL(dinnerUrl);
  await expect(page.getByRole("heading", { name: "Weekend meal" })).toBeVisible();

  await page.goto(baliUrl);
  await expect(page.getByLabel("Expense session")).toHaveValue(
    new URL(baliUrl).searchParams.get("session")!,
  );
  await expect(page.getByText("No expenses recorded yet.")).toBeVisible();

  await page.goto(dinnerUrl);
  await expect(page.getByRole("heading", { name: "Weekend meal" })).toBeVisible();
});

async function createSession(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "New session" }).click();
  await page.getByLabel("Session name").fill(name);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.getByLabel("Expense session")).toHaveValue(/\d+/);
  await expect(page.getByLabel("Expense session").locator("option:checked")).toHaveText(name);
}

async function addPerson(page: import("@playwright/test").Page, name: string) {
  await page.getByLabel("Person name").fill(name);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("checkbox", { name })).toBeVisible();
}

async function addExpense(
  page: import("@playwright/test").Page,
  expense: { description: string; amount: string; payer: string },
) {
  await page.getByLabel("Description").fill(expense.description);
  await page.getByLabel("Amount (RM)").fill(expense.amount);
  await page.getByLabel("Paid by").selectOption({ label: expense.payer });
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("heading", { name: expense.description })).toBeVisible();
}

function balanceRow(section: import("@playwright/test").Locator, name: string) {
  return section.getByText(name, { exact: true }).locator("..");
}
