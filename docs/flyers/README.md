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

## `gpaa-lifetime-ldma-upgrade-mailer.html`

- **Trim size**: 8.5" × 11" (US Letter)
- **Bleed**: 0.125" on all sides (built into the PDF page size)
- **Safe margin**: 0.4" on front and upper back
- **Sides**: 2 pages (Front = Side A, Back = Side B)
- **Campaign**: GPAA Lifetime → dual GPAA/LDMA upgrade ($500 or $900 + Legacy bundle); copy matches `docs/email-salesforce-gpaa-lifetime-ldma-upgrade-pre2014.html`
- **Front layout**: Letter masthead, subject line, blank **address window** (4" × 1.35", left-aligned below subject) for windowed-envelope mail merge; offer content below
- **Back layout**: Upper section = offer details; **bottom panel** (~3.38") = detachable order form with perforation marks, blank address box for mail merge, $500/$900 checkboxes, check or credit card payment fields, signature, and return address **PO Box 891509, Temecula, CA 92589**
- **QR code**: `../../public/images/lifetime-upgrade-qr.png`
- **Logo**: `../../public/images/50th-logo.png`

### Export to PDF

1. Open `docs/flyers/gpaa-lifetime-ldma-upgrade-mailer.html` in Chrome
2. Print → **Save as PDF**
3. More settings: **Margins: None**, **Background graphics: On**
4. For professional print with perforation scoring, provide the PDF to your mail house and specify score/cut at the dashed line (~3.38" from bottom of back)

## `family-legacy-complete-bundle-mailer.html`

- **Trim size**: 8.5" × 11" (US Letter) — same print/export steps as the GPAA upgrade mailer
- **Audience**: LDMA members without email on file (direct mail)
- **Offer**: Complete Family Legacy Bundle — **$600** (retail $3,250 · save $2,650); Pre-Paid Transfer Fee, Companion & Transferability
- **Expires**: 6/21/26 · copy matches `docs/email-klaviyo-family-legacy-complete-bundle-50th.html`
- **Front layout**: Letter masthead, subject line, blank **address window** (4" × 1.35") for windowed-envelope mail merge; offer content below
- **Back layout**: Bundle details + QR; **bottom panel** (~3.38") = detachable order form (blank address, LDMA member #, $600 order checkbox, check or credit card, signature)
- **QR code**: `../../public/images/family-legacy-qr.png` → `https://myldma.com/family-legacy`
- **Product image**: Shopify CDN (see HTML comment)
- **Logo**: `../../public/images/50th-logo.png`
- **Return address**: PO Box 891509, Temecula, CA 92589

