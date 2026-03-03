# Legacy Offer Products — Shopify Import

## File

`legacy-offer-products-shopify.csv` — 5 products ready for Shopify product import.

## Import steps

1. In Shopify Admin: **Products** → **Import**.
2. Upload `legacy-offer-products-shopify.csv`.
3. Click **Import products**.
4. After import, assign each product to **LDMA 50th Anniversary Frontend**:
   - Select the 5 imported products.
   - Click **More actions** → **Make products available** (or **Sell on your channels**).
   - Choose **LDMA 50th Anniversary Frontend** and publish.

## Sales channel note

Shopify’s native CSV import does **not** include a Sales Channel column. Products are imported as **drafts** (`Published = FALSE`). You must manually assign them to “LDMA 50th Anniversary Frontend” after import and publish them there.

If you use a third‑party app (e.g. PH CSV Import) that supports a Sales Channel column, you can add that column with value `LDMA 50th Anniversary Frontend` if that matches your channel’s exact name.

## Product handles (for website linking)

| Offer type | Handle |
|------------|--------|
| all-three | `legacy-complete-package` |
| transferability-prepay | `legacy-transferability-prepay` |
| companion-prepay | `legacy-companion-prepay` |
| companion-only | `legacy-companion-only` |
| prepay-only | `legacy-prepay-only` |

Use these handles when adding product links to the member profile or email flow.
