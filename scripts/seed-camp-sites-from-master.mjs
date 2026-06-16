#!/usr/bin/env node
/**
 * Seed camp_sites from data/camp-reservations/camp-site-master.csv (all 8 camps).
 * Run after migrate-camp-sites.sql and migrate-camp-sites-v2.sql.
 *
 *   npm run db:export:camp-site-master
 *   npm run db:seed:camp-sites-master
 *   npm run db:seed:camp-sites-master -- --exclude=burnt-river-oregon,vein-mountain-north-carolina
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString =
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

const csvPath = join(__dirname, "..", "data", "camp-reservations", "camp-site-master.csv");

function parseArgs(argv) {
  let only = null;
  let exclude = null;
  for (const arg of argv) {
    if (arg.startsWith("--only=")) {
      only = new Set(
        arg
          .slice("--only=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
    if (arg.startsWith("--exclude=")) {
      exclude = new Set(
        arg
          .slice("--exclude=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }
  return { only, exclude };
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseOptionalFloat(s) {
  const t = (s || "").trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => {
      row[h] = (parts[j] || "").trim();
    });
    if (!row.camp_slug || !row.site_code) continue;
    rows.push(row);
  }
  return rows;
}

function formatSiteDisplayName(siteCode, siteType, specialType) {
  const parts = [siteCode];
  if (specialType) parts.push(specialType);
  if (siteType) parts.push(String(siteType).trim());
  return parts.join(" — ");
}

function shouldIncludeCamp(slug, only, exclude) {
  if (only && !only.has(slug)) return false;
  if (exclude && exclude.has(slug)) return false;
  return true;
}

async function run() {
  const { only, exclude } = parseArgs(process.argv.slice(2));

  if (!connectionString) {
    console.error("Error: STORAGE_DATABASE_URL, POSTGRES_URL, or DATABASE_URL not set.");
    process.exit(1);
  }
  if (!existsSync(csvPath)) {
    console.error("Error: CSV not found. Run: npm run db:export:camp-site-master");
    console.error(csvPath);
    process.exit(1);
  }

  let rows = parseCsv(readFileSync(csvPath, "utf8"));
  if (only) {
    rows = rows.filter((r) => only.has(r.camp_slug));
    console.log("Filter --only:", [...only].join(", "));
  }
  if (exclude) {
    rows = rows.filter((r) => !exclude.has(r.camp_slug));
    console.log("Filter --exclude:", [...exclude].join(", "));
  }
  if (rows.length === 0) {
    console.error("Error: No rows after filters.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  const byCamp = new Map();
  console.log("Seeding camp_sites from", csvPath, `(${rows.length} rows)`);

  for (const row of rows) {
    const campSlug = row.camp_slug;
    if (!shouldIncludeCamp(campSlug, only, exclude)) continue;

    const siteCode = row.site_code;
    const specialType = row.special_type || null;
    const siteType = row.site_type || "rv";
    const sortOrder = parseInt(row.sort_order, 10) || 0;
    const memberMonthly = parseOptionalFloat(row.member_rate_monthly);
    const memberDaily = parseOptionalFloat(row.member_rate_daily);
    const nonMemberDaily = parseOptionalFloat(row.non_member_rate_daily);
    const name = formatSiteDisplayName(siteCode, siteType, specialType);

    await client.query(
      `INSERT INTO camp_sites (
         camp_slug, site_code, name, site_type, special_type, sort_order,
         member_rate_monthly, member_rate_daily, non_member_rate_daily
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (camp_slug, site_code) WHERE site_code IS NOT NULL DO UPDATE SET
         name = EXCLUDED.name,
         site_type = EXCLUDED.site_type,
         special_type = EXCLUDED.special_type,
         sort_order = EXCLUDED.sort_order,
         member_rate_monthly = EXCLUDED.member_rate_monthly,
         member_rate_daily = EXCLUDED.member_rate_daily,
         non_member_rate_daily = EXCLUDED.non_member_rate_daily,
         updated_at = NOW()`,
      [
        campSlug,
        siteCode,
        name,
        siteType,
        specialType,
        sortOrder,
        memberMonthly,
        memberDaily,
        nonMemberDaily,
      ]
    );

    byCamp.set(campSlug, (byCamp.get(campSlug) || 0) + 1);
    console.log("  ✓", campSlug, siteCode, name);
  }

  await client.end();
  console.log("Done. Sites per camp:");
  for (const [slug, n] of [...byCamp.entries()].sort()) {
    console.log(`  ${slug}: ${n}`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
