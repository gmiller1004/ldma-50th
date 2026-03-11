#!/usr/bin/env node
/**
 * Run community migrations (edit support, reactions).
 * Usage: node --env-file=.env.local scripts/migrate-community.mjs
 * Or:   npm run db:migrate
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
  console.error("Error: STORAGE_DATABASE_URL, POSTGRES_URL, or DATABASE_URL not set.");
  process.exit(1);
}

const migrations = [
  "migrate-community-edit-reactions.sql",
  "migrate-member-avatars.sql",
  "migrate-member-notifications.sql",
  "migrate-exclusive-offers-notify.sql",
  "migrate-exclusive-offers-notified-products.sql",
  "migrate-member-shopify-tokens.sql",
  "migrate-member-shopify-oauth.sql",
  "migrate-oauth-state.sql",
  "migrate-oauth-state-pkce.sql",
  "migrate-claims.sql",
  "seed-stanton-claims.sql",
  "migrate-camp-sites.sql",
  "migrate-camp-reservations.sql",
  "migrate-camp-payments.sql",
];

let fullSql = migrations
  .map((f) => readFileSync(join(__dirname, f), "utf8"))
  .join("\n");
fullSql = fullSql.replace(/--[^\n]*/g, "");
const statements = fullSql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Running community migration...");
  for (const stmt of statements) {
    try {
      await client.query(stmt + ";");
      console.log("  ✓", stmt.slice(0, 60).replace(/\s+/g, " ") + "…");
    } catch (e) {
      console.error("  ✗", e.message);
    }
  }
  await client.end();
  console.log("Done.");
}

run();
