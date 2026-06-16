#!/usr/bin/env node
/**
 * ResNexus import columns on camp_reservations + billing period uniqueness.
 * Usage: npm run db:migrate:camp-reservations-import
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

const sql = readFileSync(join(__dirname, "migrate-camp-reservations-import.sql"), "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Running camp reservations import migration…");
  for (const stmt of statements) {
    await client.query(stmt + ";");
    console.log("  ✓", stmt.slice(0, 70).replace(/\s+/g, " ") + "…");
  }
  await client.end();
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
