# Camp site data (reservation system)

Used to seed bookable sites for the reservation system. One CSV per camp.

## Burnt River (pilot)

1. **Copy the template** to the fill-in file:
   ```bash
   cp burnt-river-sites.template.csv burnt-river-sites.csv
   ```
2. **Edit `burnt-river-sites.csv`** with real site info (one row per site).
3. Do not commit `burnt-river-sites.csv` — it is gitignored. The seed script will read it when building the reservation system.

### CSV columns

| Column                  | Required | Description |
|-------------------------|----------|-------------|
| `name`                  | Yes      | Display name (e.g. "Site 1", "RV-5", "Cabin A"). |
| `site_type`             | Yes      | One of: `rv`, `tent`, `cabin`. Used for pricing and filtering. |
| `sort_order`            | Yes      | Number for display order (1, 2, 3, …). |
| `member_rate_daily`     | No       | Daily rate for LDMA members (e.g. 25.00). Leave blank if using a default. |
| `non_member_rate_daily` | No       | Daily rate for non-members/guests (e.g. 35.00). Leave blank if using a default. |
| `notes`                 | No       | Optional notes (e.g. "Full hookup", "Near bathhouse"). |

**Long-stay discount:** Apply **10% discount for stays of 30+ days** across the board (member and non-member). Handled in reservation/payment logic, not in the CSV.
