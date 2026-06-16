#!/usr/bin/env python3
"""Export LDMA CAMP SITE MASTER xlsx sheet 2026 to camp-site-master.csv."""
from __future__ import annotations

import csv
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("pip install openpyxl", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
XLSX_DEFAULT = ROOT / "data" / "camp-reservations" / "LDMA CAMP SITE MASTER - v01 2.xlsx"
OUT = ROOT / "data" / "camp-reservations" / "camp-site-master.csv"

CAMP_TO_SLUG = {
    "Stanton": "stanton-arizona",
    "Italian Bar": "italian-bar-california",
    "Duisenburg": "duisenburg-california",
    "Blue Bucket": "blue-bucket-oregon",
    "Burnt River": "burnt-river-oregon",
    "Oconee": "oconee-south-carolina",
    "Loud Mine": "loud-mine-georgia",
    "Vein Mountain": "vein-mountain-north-carolina",
}

FIELDS = [
    "camp_slug",
    "camp_name",
    "site_code",
    "special_type",
    "site_type",
    "member_rate_monthly",
    "member_rate_daily",
    "non_member_rate_daily",
    "sort_order",
]


def num(val) -> str:
    if val is None or val == "":
        return ""
    if isinstance(val, (int, float)):
        return str(val)
    return str(val).strip()


def main() -> None:
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else XLSX_DEFAULT
    if not xlsx.exists():
        print(f"Missing {xlsx}", file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    ws = wb["2026"]
    rows_out: list[dict[str, str]] = []
    sort_order = 0

    for row in ws.iter_rows(min_row=12, values_only=True):
        camp = row[0]
        site_code = row[1]
        if not camp or camp == "CAMP" or site_code is None or str(site_code).strip() == "":
            continue
        camp_name = str(camp).strip()
        slug = CAMP_TO_SLUG.get(camp_name)
        if not slug:
            print(f"Skip unknown camp: {camp_name}", file=sys.stderr)
            continue
        sort_order += 1
        special = row[2]
        rows_out.append(
            {
                "camp_slug": slug,
                "camp_name": camp_name,
                "site_code": str(site_code).strip(),
                "special_type": str(special).strip() if special else "",
                "site_type": str(row[3] or "").strip(),
                "member_rate_monthly": num(row[4]),
                "member_rate_daily": num(row[5]),
                "non_member_rate_daily": num(row[7]),
                "sort_order": str(sort_order),
            }
        )

    wb.close()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows_out)

    camps = {r["camp_slug"] for r in rows_out}
    print(f"Wrote {len(rows_out)} sites across {len(camps)} camps → {OUT}")


if __name__ == "__main__":
    main()
