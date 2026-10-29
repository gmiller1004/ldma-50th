/**
 * Swap sites for David Franks (site 16) and Eddie Reed (site 18). Dates and pricing are unchanged.
 *
 *   npx tsx --env-file=.env.local scripts/repair-swap-franks-reed-sites.ts            (dry run)
 *   npx tsx --env-file=.env.local scripts/repair-swap-franks-reed-sites.ts --execute
 */
import { sql } from "@/lib/db";
import { getReservationNetPaidCents } from "@/lib/reservation-billing";
import { toDateOnlyStr } from "@/lib/reservation-dates";

const execute = process.argv.includes("--execute");
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

type Row = {
  id: string;
  camp_slug: string;
  site_id: string;
  site_code: string | null;
  site_name: string;
  site_type: string;
  special_type: string | null;
  member_rate_daily: number | string | null;
  member_rate_monthly: number | string | null;
  non_member_rate_daily: number | string | null;
  name: string;
  reservation_type: string;
  status: string;
  check_in_date: string | Date;
  check_out_date: string | Date;
  nights: number;
  calculated_total_cents: number | null;
  price_override_flag: boolean | null;
  amount_override_cents: number | null;
  invoice_number: string | null;
};

async function find(lastName: string, firstName: string): Promise<Row[]> {
  return (await sql!`
    SELECT r.id, r.camp_slug, r.site_id, s.site_code, s.name AS site_name, s.site_type, s.special_type,
           s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily,
           COALESCE(NULLIF(r.member_display_name, ''), TRIM(CONCAT(r.guest_first_name, ' ', r.guest_last_name))) AS name,
           r.reservation_type, r.status, r.check_in_date, r.check_out_date, r.nights,
           r.calculated_total_cents, r.price_override_flag, r.amount_override_cents, r.invoice_number
    FROM camp_reservations r JOIN camp_sites s ON s.id = r.site_id
    WHERE r.status <> 'cancelled'
      AND (
        (r.member_display_name ILIKE ${"%" + lastName + "%"} AND r.member_display_name ILIKE ${"%" + firstName + "%"})
        OR (r.guest_last_name ILIKE ${lastName} AND r.guest_first_name ILIKE ${firstName + "%"})
      )
    ORDER BY r.check_in_date
  `) as Row[];
}

async function describe(r: Row) {
  const paid = await getReservationNetPaidCents(r.id);
  console.log(
    `  ${r.id} · ${r.camp_slug} · site ${r.site_code ?? "—"} (${r.site_name}; ${r.special_type ? r.special_type + " — " : ""}${r.site_type}) · ` +
      `${r.name} (${r.reservation_type}, ${r.status}) · ${toDateOnlyStr(r.check_in_date)} → ${toDateOnlyStr(r.check_out_date)} (${r.nights}n) · ` +
      `calc ${money(r.calculated_total_cents ?? 0)}${r.price_override_flag ? ` · override ${money(r.amount_override_cents ?? 0)}` : ""} · ` +
      `paid ${money(paid)} · invoice ${r.invoice_number ?? "—"} · rates m/d ${r.member_rate_daily} m/mo ${r.member_rate_monthly} g/d ${r.non_member_rate_daily}`
  );
}

async function main() {
  if (!sql) throw new Error("no db");

  const franksRows = await find("Franks", "David");
  const reedRows = await find("Reed", "Eddie");
  console.log("Franks matches:");
  for (const r of franksRows) await describe(r);
  console.log("Reed matches:");
  for (const r of reedRows) await describe(r);

  const franks = franksRows.filter((r) => r.site_code === "16");
  const reed = reedRows.filter((r) => r.site_code === "18");
  if (franks.length !== 1 || reed.length !== 1) {
    throw new Error(`Expected exactly one Franks on 16 and one Reed on 18; found ${franks.length} and ${reed.length}`);
  }
  const f = franks[0];
  const e = reed[0];
  if (f.camp_slug !== e.camp_slug) throw new Error("Reservations are at different camps");

  const sameRates =
    String(f.member_rate_daily) === String(e.member_rate_daily) &&
    String(f.member_rate_monthly) === String(e.member_rate_monthly) &&
    String(f.non_member_rate_daily) === String(e.non_member_rate_daily);
  console.log(`\nSite rates identical: ${sameRates ? "yes" : "NO"}`);

  const conflicts = await sql`
    SELECT r.id, s.site_code, r.check_in_date, r.check_out_date
    FROM camp_reservations r JOIN camp_sites s ON s.id = r.site_id
    WHERE r.status <> 'cancelled'
      AND r.id NOT IN (${f.id}, ${e.id})
      AND (
        (r.site_id = ${e.site_id} AND r.check_in_date < ${toDateOnlyStr(f.check_out_date)} AND r.check_out_date > ${toDateOnlyStr(f.check_in_date)})
        OR (r.site_id = ${f.site_id} AND r.check_in_date < ${toDateOnlyStr(e.check_out_date)} AND r.check_out_date > ${toDateOnlyStr(e.check_in_date)})
      )
  `;
  console.log(`Other reservations blocking the swap: ${Array.isArray(conflicts) ? conflicts.length : 0}`);
  if (Array.isArray(conflicts) && conflicts.length > 0) {
    console.log(conflicts);
    throw new Error("Swap would overlap another reservation");
  }

  if (!execute) {
    console.log("\nDry run — pass --execute to swap.");
    return;
  }

  await sql.transaction((tx) => [
    tx`UPDATE camp_reservations SET site_id = ${e.site_id}, updated_at = NOW() WHERE id = ${f.id}`,
    tx`UPDATE camp_reservations SET site_id = ${f.site_id}, updated_at = NOW() WHERE id = ${e.id}`,
  ]);

  console.log("\nApplied. Now:");
  for (const r of [...(await find("Franks", "David")), ...(await find("Reed", "Eddie"))]) await describe(r);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
