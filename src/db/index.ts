import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to connect to the database.");
}

// Neon uses a connection pool. Prepared statements are disabled for compatibility
// with pooled connections.
export const sql = postgres(databaseUrl, { prepare: false });
export const db = drizzle(sql, { schema });
