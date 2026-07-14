import "dotenv/config";

import { db, sql } from "@/db";
import { expenseSessions, expenses, people } from "@/db/schema";

if (process.env.PLAYWRIGHT_TEST_DATABASE !== "true") {
  throw new Error("Refusing to reset a database outside the Playwright test environment.");
}

async function resetTestDatabase() {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(expenses);
      await tx.delete(people);
      await tx.delete(expenseSessions);
      await tx.insert(expenseSessions).values({ name: "Default session" });
    });
  } finally {
    await sql.end();
  }
}

resetTestDatabase().catch((error: unknown) => {
  console.error("Test database reset failed.", error);
  process.exitCode = 1;
});
