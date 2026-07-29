#!/usr/bin/env node
/**
 * Merge Stanton v02 rate update into data/camp-reservations/camp-site-master.csv.
 * Only updates stanton-arizona rows; other camps are left untouched.
 *
 *   node scripts/merge-stanton-site-master-v02.mjs
 *   node scripts/merge-stanton-site-master-v02.mjs --dry-run
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data", "camp-reservations");
const masterPath = join(dataDir, "camp-site-master.csv");
const updatePath = join(dataDir, "LDMA STANTON CAMP SITE MASTER UPDATE- v02.csv");

const CAMP_SLUG = "stanton-arizona";
const CAMP_NAME = "Stanton";

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

function parseMoney(s) {
  const t = String(s || "")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

function moneyToCsv(n) {
  if (n == null || Number.isNaN(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}

/** Parse the ops-format Stanton v02 update CSV into master-shaped rows. */
function parseStantonV02(content) {
  const byCode = new Map();
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim().toLowerCase().startsWith("stanton,")) continue;
    const parts = parseCsvLine(line);
    const siteCode = (parts[1] || "").trim();
    if (!siteCode) continue;
    byCode.set(siteCode, {
      camp_slug: CAMP_SLUG,
      camp_name: CAMP_NAME,
      site_code: siteCode,
      special_type: (parts[2] || "").trim(),
      site_type: (parts[3] || "").trim(),
      member_rate_monthly: moneyToCsv(parseMoney(parts[4])),
      member_rate_daily: moneyToCsv(parseMoney(parts[5])),
      // parts[6] is empty spacer; parts[7] is non-member daily
      non_member_rate_daily: moneyToCsv(parseMoney(parts[7])),
    });
  }
  return byCode;
}

function parseMaster(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => {
      row[h] = (parts[j] || "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function escapeCsvField(s) {
  const t = String(s ?? "");
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function rowToCsv(headers, row) {
  return headers.map((h) => escapeCsvField(row[h] ?? "")).join(",");
}

function run() {
  const dryRun = process.argv.includes("--dry-run");
  if (!existsSync(masterPath)) {
    console.error("Missing master CSV:", masterPath);
    process.exit(1);
  }
  if (!existsSync(updatePath)) {
    console.error("Missing Stanton v02 update CSV:", updatePath);
    process.exit(1);
  }

  const updates = parseStantonV02(readFileSync(updatePath, "utf8"));
  const { headers, rows } = parseMaster(readFileSync(masterPath, "utf8"));

  let changed = 0;
  let missingInUpdate = 0;
  let added = 0;
  const masterCodes = new Set();

  for (const row of rows) {
    if (row.camp_slug !== CAMP_SLUG) continue;
    masterCodes.add(row.site_code);
    const u = updates.get(row.site_code);
    if (!u) {
      missingInUpdate++;
      console.log(`  ! master site ${row.site_code} not in v02 update (left unchanged)`);
      continue;
    }
    const before = {
      special_type: row.special_type || "",
      site_type: row.site_type || "",
      member_rate_monthly: row.member_rate_monthly || "",
      member_rate_daily: row.member_rate_daily || "",
      non_member_rate_daily: row.non_member_rate_daily || "",
    };
    const after = {
      special_type: u.special_type || "",
      site_type: u.site_type || "",
      member_rate_monthly: u.member_rate_monthly || "",
      member_rate_daily: u.member_rate_daily || "",
      non_member_rate_daily: u.non_member_rate_daily || "",
    };
    const same =
      before.special_type === after.special_type &&
      before.site_type === after.site_type &&
      before.member_rate_monthly === after.member_rate_monthly &&
      before.member_rate_daily === after.member_rate_daily &&
      before.non_member_rate_daily === after.non_member_rate_daily;
    if (same) continue;
    changed++;
    console.log(
      `  ~ ${row.site_code}: monthly ${before.member_rate_monthly}->${after.member_rate_monthly}` +
        ` daily ${before.member_rate_daily}->${after.member_rate_daily}` +
        ` special "${before.special_type}"->"${after.special_type}"`
    );
    row.special_type = after.special_type;
    row.site_type = after.site_type;
    row.member_rate_monthly = after.member_rate_monthly;
    row.member_rate_daily = after.member_rate_daily;
    row.non_member_rate_daily = after.non_member_rate_daily;
  }

  let maxSort = 0;
  for (const r of rows) {
    if (r.camp_slug === CAMP_SLUG) {
      maxSort = Math.max(maxSort, parseInt(r.sort_order, 10) || 0);
    }
  }

  for (const [code, u] of updates) {
    if (masterCodes.has(code)) continue;
    added++;
    maxSort += 1;
    const newRow = { ...u, sort_order: String(maxSort) };
    let insertAt = rows.length;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].camp_slug === CAMP_SLUG) {
        insertAt = i + 1;
        break;
      }
    }
    rows.splice(insertAt, 0, newRow);
    console.log(`  + ${code}: monthly ${u.member_rate_monthly} daily ${u.member_rate_daily}`);
  }

  console.log(
    `\nSummary: ${changed} changed, ${added} added, ${missingInUpdate} master sites missing from v02`
  );

  if (dryRun) {
    console.log("Dry run — camp-site-master.csv not written.");
    return;
  }

  const out = [headers.join(",")]
    .concat(rows.map((r) => rowToCsv(headers, r)))
    .join("\n");
  writeFileSync(masterPath, out + "\n", "utf8");
  console.log("Updated", masterPath);
}

run();
