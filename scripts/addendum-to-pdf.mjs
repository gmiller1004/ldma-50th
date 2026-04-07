#!/usr/bin/env node
/**
 * Convert addendum HTML to a single long PDF (one continuous page).
 * Strategy: inject a print stylesheet that defines one tall page with no margins,
 * then use preferCSSPageSize so Chromium uses that. Set viewport to match page size
 * so layout is full width and height matches.
 *
 * Usage: node scripts/addendum-to-pdf.mjs [html-file] [pdf-file]
 * Default: addendum/LDMA-Addendum-Revised-2.html -> addendum/LDMA-Addendum-Revised-2.pdf
 */
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const htmlPath = resolve(projectRoot, process.argv[2] || "addendum/LDMA-Addendum-Revised-2.html");
const pdfPath = resolve(projectRoot, process.argv[3] || htmlPath.replace(/\.html$/i, ".pdf"));

if (!existsSync(htmlPath)) {
  console.error("HTML file not found:", htmlPath);
  process.exit(1);
}

const PRINT_WIDTH_PX = 8.5 * 96; // 816

async function main() {
  let puppeteer;
  try {
    puppeteer = await import("puppeteer");
  } catch (e) {
    console.error("Puppeteer is not installed. Run: npm install --save-dev puppeteer");
    process.exit(1);
  }

  const browser = await puppeteer.default.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // Initial viewport: full print width, short height so we can measure content
    await page.setViewport({
      width: PRINT_WIDTH_PX,
      height: 800,
      deviceScaleFactor: 1,
    });

    const fileUrl = `file://${htmlPath.replace(/\\/g, "/")}`;
    await page.goto(fileUrl, { waitUntil: "networkidle0" });

    // Switch to print media before measuring
    await page.emulateMediaType("print");

    // Full document height; use bottom of last element so revision date line is never cut
    const contentHeightPx = await page.evaluate(() => {
      const bodyPaddingPx = 96; // 0.5in top + 0.5in bottom
      const scrollHeight = document.body.scrollHeight + bodyPaddingPx;
      const last = document.body.lastElementChild;
      if (!last) return scrollHeight;
      const rect = last.getBoundingClientRect();
      const bottomOfLastPx = rect.bottom + window.scrollY;
      const bottomPaddingPx = bodyPaddingPx / 2;
      const extraForMarginPx = 72; // last element margin + revision line so it stays on page 1
      return Math.ceil(Math.max(scrollHeight, bottomOfLastPx + bottomPaddingPx + extraForMarginPx));
    });

    // Measured height + 1.5in buffer so contract revision date stays on one page
    const contentInches = contentHeightPx / 96;
    const heightInches = Math.min(Math.ceil((contentInches + 1.5) * 10) / 10, 96);
    const heightPx = Math.round(heightInches * 96);

    console.log("Content height: %d px (~%s in), PDF page height: %s in", contentHeightPx, (contentHeightPx / 96).toFixed(1), heightInches);

    // Inject print CSS: one tall page, no margins, full-width layout, and disable all page breaks
    await page.addStyleTag({
      content: `
        @media print {
          @page { size: ${PRINT_WIDTH_PX}px ${heightPx}px; margin: 0 !important; }
          html, body { width: ${PRINT_WIDTH_PX}px !important; max-width: none !important; min-height: 100%; margin: 0 !important; padding: 0.5in !important; box-sizing: border-box; }
          *, *::before, *::after { page-break-after: auto !important; page-break-before: auto !important; page-break-inside: auto !important; }
        }
      `,
    });

    // Set viewport to exact PDF dimensions so layout matches 1:1 (fixes narrow column)
    await page.setViewport({
      width: PRINT_WIDTH_PX,
      height: Math.round(heightInches * 96),
      deviceScaleFactor: 1,
    });

    // Use CSS page size so Chromium uses our @page; no JS width/height so layout isn't reinterpreted
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    console.log("PDF written:", pdfPath);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
