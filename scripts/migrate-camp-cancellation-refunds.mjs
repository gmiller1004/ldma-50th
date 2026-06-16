#!/usr/bin/env node
/**
 * Cancellation refund schema (payment_type refund, reservation cancel audit).
 * Usage: npm run db:migrate:camp-cancellation-refunds
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
  console.error("Error: DATABASE_URL not set.");
  process.exit(1);
}

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
  const sql = readFileSync(join(__dirname, "migrate-camp-cancellation-refunds.sql"), "utf8");
  for (const stmt of splitStatements(sql)) {
    await client.query(stmt);
    console.log("OK:", stmt.slice(0, 60).replace(/\s+/g, " ") + "…");
  }
  await client.end();
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
