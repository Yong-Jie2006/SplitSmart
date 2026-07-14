import { expect, test } from "@playwright/test";

test("shows an amount error at the field and accepts a corrected resubmission", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Person name").fill("Amir");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Amir" })).toBeVisible();

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
  await page.getByRole("button", { name: "Add expense" }).click();

  await expect(amountError).toBeHidden();
  await expect(page.getByRole("heading", { name: "Lunch" })).toBeVisible();
});

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
