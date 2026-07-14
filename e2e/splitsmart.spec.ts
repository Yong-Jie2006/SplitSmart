import { expect, test } from "@playwright/test";

test("focuses the empty state on adding the first person and reveals the dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Start with your group" })).toBeVisible();
  await expect(page.getByText("You can record expenses once someone is in the group.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add an expense" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Balances" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Settle up" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Expense history" })).toBeHidden();

  await page.getByLabel("Person name").fill("Noor");
  await page.getByRole("button", { name: "Add your first person" }).click();

  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Noor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add an expense" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Balances" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Settle up" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Expense history" })).toBeVisible();
});

test("shows an amount error at the field and accepts a corrected resubmission", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByLabel("Person name").fill("Amir");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Amir" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Noor" }).uncheck();

  await page.getByLabel("Description").fill("Lunch");
  const amountInput = page.getByLabel("Amount (RM)");
  await amountInput.fill("10.999");
  await page.getByRole("button", { name: "Add expense" }).click();

  const amountError = page.getByText("Enter an amount such as 10 or 10.50.");
  await expect(amountError).toBeVisible();
  await expect(amountInput).toBeFocused();
  await expect(amountInput).toHaveAttribute("aria-invalid", "true");
  await expect(amountInput).toHaveAttribute("aria-describedby", "expense-amount-error");

  await amountInput.fill("10.99");
  await amountInput.press("Enter");

  await expect(amountError).toBeHidden();
  await expect(page.getByRole("heading", { name: "Lunch" })).toBeVisible();

  await page.getByRole("button", { name: "Delete Lunch" }).click();
  await page.getByRole("button", { name: "Delete expense" }).click();
  await expect(page.getByRole("heading", { name: "Lunch" })).toBeHidden();
});

test("records, settles, and deletes an unevenly split expense", async ({ page }) => {
  await page.goto("/");

  for (const name of ["Aisha", "Bee"]) {
    await page.getByLabel("Person name").fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("checkbox", { name })).toBeVisible();
  }

  await page.getByRole("checkbox", { name: "Noor" }).uncheck();
  await page.getByRole("checkbox", { name: "Amir" }).uncheck();

  await page.getByLabel("Description").fill("Dinner");
  await page.getByLabel("Amount (RM)").fill("10.01");
  await page.getByLabel("Paid by").selectOption({ label: "Aisha" });
  await page.getByRole("button", { name: "Add expense" }).click();

  await expect(page.getByRole("heading", { name: "Dinner" })).toBeVisible();
  const settlement = page.getByText("Bee pays Aisha", { exact: true }).locator("..");
  await expect(settlement).toBeVisible();
  await expect(settlement.getByText(/RM\s*5\.00/)).toBeVisible();

  const balancesSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Balances" }) });
  const aishaBalance = balancesSection.getByText("Aisha", { exact: true }).locator("..");
  const beeBalance = balancesSection.getByText("Bee", { exact: true }).locator("..");
  await expect(aishaBalance.getByText(/gets back RM\s*5\.00/)).toBeVisible();
  await expect(beeBalance.getByText(/owes RM\s*5\.00/)).toBeVisible();
  await expect(page.getByText("settled", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Delete Dinner" }).click();
  await page.getByRole("button", { name: "Delete expense" }).click();
  await expect(page.getByText("No expenses recorded yet.")).toBeVisible();
});
