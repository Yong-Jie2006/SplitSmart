import "dotenv/config";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db, sql } from "@/db";

async function runMigrations() {
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Database migrations completed.");
  } finally {
    await sql.end();
  }
}

runMigrations().catch((error: unknown) => {
  console.error("Database migration failed.", error);
  process.exitCode = 1;
});
