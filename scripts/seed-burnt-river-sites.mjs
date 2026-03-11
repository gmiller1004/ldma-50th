#!/usr/bin/env node
/**
 * Seed camp_sites for Burnt River from data/camp-sites/burnt-river-sites.csv.
 * Run after migrate-camp-sites.sql and migrate-camp-reservations.sql (tables exist).
 * Usage: node --env-file=.env.local scripts/seed-burnt-river-sites.mjs
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAMP_SLUG = "burnt-river-oregon";

const connectionString =
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Error: STORAGE_DATABASE_URL, POSTGRES_URL, or DATABASE_URL not set.");
  process.exit(1);
}

const csvPath = join(__dirname, "..", "data", "camp-sites", "burnt-river-sites.csv");
if (!existsSync(csvPath)) {
  console.error("Error: CSV not found at", csvPath);
  console.error("Copy the template: cp data/camp-sites/burnt-river-sites.template.csv data/camp-sites/burnt-river-sites.csv");
  process.exit(1);
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const name = (parts[0] || "").trim();
    const site_type = (parts[1] || "").trim() || "rv";
    const sort_order = parseInt(parts[2], 10) || i;
    const member_rate_daily = parts[3] != null && parts[3].trim() !== "" ? parseFloat(parts[3].trim()) : null;
    const non_member_rate_daily = parts[4] != null && parts[4].trim() !== "" ? parseFloat(parts[4].trim()) : null;
    const notes = parts.length > 5 ? parts.slice(5).join(",").trim() || null : null;
    if (!name) continue;
    rows.push({
      name,
      site_type,
      sort_order: Number.isNaN(sort_order) ? i : sort_order,
      member_rate_daily: Number.isNaN(member_rate_daily) ? null : member_rate_daily,
      non_member_rate_daily: Number.isNaN(non_member_rate_daily) ? null : non_member_rate_daily,
      notes: notes || null,
    });
  }
  return rows;
}

async function run() {
  const csv = readFileSync(csvPath, "utf8");
  const rows = parseCSV(csv);
  if (rows.length === 0) {
    console.error("Error: No data rows in CSV.");
    process.exit(1);
  }
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Seeding camp_sites for", CAMP_SLUG, "from", csvPath, "(", rows.length, "rows)");
  for (const row of rows) {
    await client.query(
      `INSERT INTO camp_sites (camp_slug, name, site_type, sort_order, member_rate_daily, non_member_rate_daily, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (camp_slug, name) DO UPDATE SET
         site_type = EXCLUDED.site_type,
         sort_order = EXCLUDED.sort_order,
         member_rate_daily = EXCLUDED.member_rate_daily,
         non_member_rate_daily = EXCLUDED.non_member_rate_daily,
         notes = EXCLUDED.notes,
         updated_at = NOW()`,
      [
        CAMP_SLUG,
        row.name,
        row.site_type,
        row.sort_order,
        row.member_rate_daily,
        row.non_member_rate_daily,
        row.notes,
      ]
    );
    console.log("  ✓", row.name);
  }
  await client.end();
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
