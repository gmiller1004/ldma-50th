# Flyers

## `add-on-offers-flyer.html`

- **Trim size**: 8" × 10.5"
- **Bleed**: 0.125" on all sides (built into the PDF page size)
- **Safe margin**: 0.35" (content is kept inside)
- **Sides**: 2 pages (Front = Side A, Back = Side B)

### Export to PDF

1. Open `docs/flyers/add-on-offers-flyer.html` in Chrome
2. Print
3. Destination: **Save as PDF**
4. More settings:
   - Paper size: **(use default; page is controlled by CSS @page)**
   - Margins: **None**
   - Background graphics: **On**

### Customization

- The flyer references images via **relative paths** so it works when opened directly in a browser from disk:
  - `../../public/images/50th-logo.png`
  - `../../public/images/family-legacy-qr.png` (destination: `https://myldma.com/family-legacy`)
- To regenerate the QR: `node scripts/generate-family-legacy-qr.mjs`
- If you want fewer offers (3–5), remove cards from the front grid and enlarge the remaining cards.

## `lifetime-membership-bundle-flyer.html`

- **Trim size**: 8" × 10.5" (same print/export steps as above)
- **Front**: Story + price ribbon + benefit grid (LDMA, GPAA, Companion, Transferability, Pre‑Paid Transfer, detector summary); **no** comparison tables (those are on the back).
- **Back**: Detectors → Kevin Hoagland / goldtrails.gold → comparison charts → learn more → CTA.
- **CTA QR**: `public/images/memberships-qr.png` → `https://myldma.com/memberships`
- **Regenerate QR**: `node scripts/generate-memberships-qr.mjs`
- **Logo**: `public/images/50th-logo.png`
- **Detector images**: `public/images/flyers/` (Minelab GM1000/GM2000 webp, Garrett PNG)

