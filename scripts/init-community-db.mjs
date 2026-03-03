#!/usr/bin/env node
/**
 * Run the community schema SQL against your Neon database.
 * Usage: node --env-file=.env.local scripts/init-community-db.mjs
 * Or:   npm run db:init
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

// Prefer new Neon (STORAGE_*); fall back to old free Neon
const connectionString =
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "Error: STORAGE_DATABASE_URL, POSTGRES_URL, or DATABASE_URL not set. Load .env.local or set the variable."
  );
  console.error("  Try: node --env-file=.env.local scripts/init-community-db.mjs");
  process.exit(1);
}

const sqlPath = join(__dirname, "init-community-db.sql");
let fullSql = readFileSync(sqlPath, "utf8");

// Remove single-line comments (-- ...) so semicolons inside comments don't break splitting
fullSql = fullSql.replace(/--[^\n]*/g, "");

// Split into statements: by semicolon, trim, filter empty
const statements = fullSql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Running community schema on Neon...");
  let ok = 0;
  let err = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt + ";");
      ok++;
      const preview = stmt.slice(0, 50).replace(/\s+/g, " ");
      console.log(`  ✓ ${preview}${stmt.length > 50 ? "…" : ""}`);
    } catch (e) {
      err++;
      console.error(`  ✗ Failed:`, e.message);
      console.error(`    Statement: ${stmt.slice(0, 80)}…`);
    }
  }
  await client.end();
  console.log(`\nDone. ${ok} succeeded, ${err} failed.`);
  process.exit(err > 0 ? 1 : 0);
}

run();
