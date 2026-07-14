import { expect, test } from "@playwright/test";

test("records, settles, and deletes an unevenly split expense", async ({ page }) => {
  await page.goto("/");

  for (const name of ["Aisha", "Bee"]) {
    await page.getByLabel("Person name").fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }

  await page.getByLabel("Description").fill("Dinner");
  await page.getByLabel("Amount (RM)").fill("10.01");
  await page.getByLabel("Paid by").selectOption({ label: "Aisha" });
  await page.getByRole("button", { name: "Add expense" }).click();

  await expect(page.getByRole("heading", { name: "Dinner" })).toBeVisible();
  await expect(page.getByText("Bee pays Aisha", { exact: true })).toBeVisible();
  await expect(page.getByText(/RM\s*5\.00/)).toBeVisible();

  await page.getByRole("button", { name: "Delete Dinner" }).click();
  await page.getByRole("button", { name: "Delete expense" }).click();
  await expect(page.getByText("No expenses recorded yet.")).toBeVisible();
});
