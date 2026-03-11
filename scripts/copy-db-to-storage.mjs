#!/usr/bin/env node
/**
 * Copy all data from old Neon (POSTGRES_URL / DATABASE_URL) to new Neon (STORAGE_DATABASE_URL).
 * Run after migrations have created the schema on the new DB.
 *
 * Usage: node --env-file=.env.local scripts/copy-db-to-storage.mjs
 *
 * Steps:
 * 1. Truncate all tables on NEW (so we don't get duplicates or FK errors).
 * 2. For each table, SELECT * from OLD and INSERT into NEW in batches.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const oldUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const newUrl = process.env.STORAGE_DATABASE_URL;

// Copy in dependency order (parents before children) to satisfy foreign keys
const COPY_ORDER = [
  "blog_categories",
  "blog_posts",
  "blog_comments",
  "community_members",
  "community_discussions",
  "community_comments",
  "community_photos",
  "community_video_links",
  "community_reactions",
  "claims",
  "exclusive_offers_notified_products",
  "member_avatars",
  "member_notification_preferences",
  "member_shopify_tokens",
  "member_rewards",
  "member_point_transactions",
  "caretaker_check_ins",
  "caretaker_guest_check_ins",
  "camp_sites",
  "camp_reservations",
  "camp_payments",
  "oauth_state",
];

if (!oldUrl) {
  console.error("Error: DATABASE_URL or POSTGRES_URL not set (source / old Neon).");
  process.exit(1);
}
if (!newUrl) {
  console.error("Error: STORAGE_DATABASE_URL not set (target / new Neon).");
  process.exit(1);
}

async function getPublicTables(client) {
  const res = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return res.rows.map((r) => r.tablename);
}

async function getTableColumns(client, table) {
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return res.rows.map((r) => r.column_name);
}

async function getTableColumnTypes(newClient, table) {
  const res = await newClient.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return Object.fromEntries(res.rows.map((r) => [r.column_name, r.data_type]));
}

async function truncateAllTables(client, tables) {
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t}"`).join(", ");
  await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function copyTable(oldClient, newClient, table) {
  const oldCols = await getTableColumns(oldClient, table);
  const newCols = await getTableColumns(newClient, table);
  const newTypes = await getTableColumnTypes(newClient, table);
  const columns = newCols.filter((c) => oldCols.includes(c));
  if (columns.length === 0) return 0;

  const selectCols = columns.map((c) => `"${c}"`).join(", ");
  const res = await oldClient.query(`SELECT ${selectCols} FROM "${table}"`);
  const rows = res.rows;
  if (rows.length === 0) return 0;

  const cols = columns.map((c) => `"${c}"`).join(", ");
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const valuePlaces = batch.map((_, b) => {
      const start = b * columns.length;
      return "(" + columns.map((_, c) => `$${start + c + 1}`).join(", ") + ")";
    }).join(", ");
    const values = batch.flatMap((row) =>
      columns.map((c) => {
        const v = row[c];
        const dtype = newTypes[c];
        if (v !== null && typeof v === "object") {
          if (dtype === "jsonb" || dtype === "json") {
            return JSON.stringify(v);
          }
        }
        return v;
      })
    );
    await newClient.query(
      `INSERT INTO "${table}" (${cols}) VALUES ${valuePlaces}`,
      values
    );
    inserted += batch.length;
  }
  return inserted;
}

async function main() {
  const oldClient = new Client({ connectionString: oldUrl });
  const newClient = new Client({ connectionString: newUrl });

  await oldClient.connect();
  await newClient.connect();

  try {
    const oldTables = await getPublicTables(oldClient);
    const newTables = await getPublicTables(newClient);
    let tables = oldTables.filter((t) => newTables.includes(t));
    const onlyOld = oldTables.filter((t) => !newTables.includes(t));
    if (onlyOld.length) {
      console.log("Tables on old DB only (skipped):", onlyOld.join(", "));
    }
    // Sort by dependency order so parents are copied before children
    tables = tables.slice().sort((a, b) => {
      const ia = COPY_ORDER.indexOf(a);
      const ib = COPY_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    console.log("Tables to copy (in order):", tables.join(", "));

    if (tables.length === 0) {
      console.log("No tables in common. Ensure migrations (and db:blog:init if needed) have been run on the new DB.");
      return;
    }

    console.log("Truncating tables on new DB...");
    await truncateAllTables(newClient, tables);

    for (const table of tables) {
      const n = await copyTable(oldClient, newClient, table);
      console.log(`  ${table}: ${n} rows`);
    }

    console.log("Done.");
  } finally {
    await oldClient.end();
    await newClient.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
