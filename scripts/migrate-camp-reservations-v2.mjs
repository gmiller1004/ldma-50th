#!/usr/bin/env node
/**
 * Phase 1 camp reservation migrations (site master v2 + billing periods).
 * Usage: npm run db:migrate:camp-reservations-v2
 *
 * Uses STORAGE_DATABASE_URL / POSTGRES_URL / DATABASE_URL from .env.local
 * (no psql required).
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString =
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: STORAGE_DATABASE_URL, POSTGRES_URL, or DATABASE_URL not set.");
  console.error("Run: npm run db:migrate:camp-reservations-v2  (loads .env.local)");
  process.exit(1);
}

const migrations = ["migrate-camp-sites-v2.sql", "migrate-camp-billing-periods.sql"];

function splitStatements(sql) {
  const withoutComments = sql.replace(/--[^\n]*/g, "");
  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Running camp reservations v2 migrations…");

  for (const file of migrations) {
    const path = join(__dirname, file);
    const sql = readFileSync(path, "utf8");
    const statements = splitStatements(sql);
    console.log(`\n${file} (${statements.length} statements)`);
    for (const stmt of statements) {
      try {
        await client.query(stmt + ";");
        console.log("  ✓", stmt.slice(0, 70).replace(/\s+/g, " ") + "…");
      } catch (e) {
        console.error("  ✗", e.message);
        console.error("    Statement:", stmt.slice(0, 120).replace(/\s+/g, " "));
        await client.end();
        process.exit(1);
      }
    }
  }

  await client.end();
  console.log("\nDone.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
