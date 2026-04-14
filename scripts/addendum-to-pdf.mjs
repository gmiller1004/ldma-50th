#!/usr/bin/env node
/**
 * Convert addendum HTML to a single long PDF (one continuous page).
 *
 * Do NOT use a provisional @page with a huge height (e.g. 100000px): Chromium may emit that
 * height in the PDF MediaBox (75000pt) even if a later @page rule tries to override—Illustrator
 * then shows a document ~63000–75000px tall.
 *
 * Measure in screen mode (no print @page). Generate with explicit page.pdf width/height and
 * preferCSSPageSize: false so the PDF page box matches content.
 *
 * Usage: node scripts/addendum-to-pdf.mjs [html-file] [pdf-file]
 * Default: addendum/LDMA-Addendum-Revised-3.html -> addendum/LDMA-Addendum-Revised-3.pdf
 */
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const htmlPath = resolve(projectRoot, process.argv[2] || "addendum/LDMA-Addendum-Revised-3.html");
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

    await page.setViewport({
      width: PRINT_WIDTH_PX,
      height: 800,
      deviceScaleFactor: 1,
    });

    const fileUrl = `file://${htmlPath.replace(/\\/g, "/")}`;
    await page.goto(fileUrl, { waitUntil: "networkidle0" });

    // Measure in screen mode: same body padding as the HTML default (0.5in), no @page / print
    // pagination affecting scrollHeight.
    await page.emulateMediaType("screen");
    await page.addStyleTag({
      content: `
        body {
          width: ${PRINT_WIDTH_PX}px !important;
          max-width: none !important;
          margin: 0 auto !important;
          box-sizing: border-box;
        }
      `,
    });

    const contentHeightPx = await page.evaluate(() => {
      const scroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const last = document.body.lastElementChild;
      if (!last) return Math.ceil(scroll);
      const bottom = last.getBoundingClientRect().bottom + window.scrollY;
      return Math.ceil(Math.max(scroll, bottom + 48));
    });

    const BUFFER_PX = Math.round(1.5 * 96);
    const heightPx = Math.min(Math.ceil(contentHeightPx + BUFFER_PX), 96 * 96);

    console.log(
      "Content height: %d px (~%s in), PDF page height: %s in (%d px)",
      contentHeightPx,
      (contentHeightPx / 96).toFixed(2),
      (heightPx / 96).toFixed(2),
      heightPx
    );

    // Print layout for output: one @page only, matching measured height (no giant placeholder).
    await page.emulateMediaType("print");
    await page.addStyleTag({
      content: `
        @media print {
          @page { size: ${PRINT_WIDTH_PX}px ${heightPx}px; margin: 0 !important; }
          html, body {
            width: ${PRINT_WIDTH_PX}px !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0.5in !important;
            box-sizing: border-box;
          }
          *, *::before, *::after {
            page-break-after: auto !important;
            page-break-before: auto !important;
            page-break-inside: auto !important;
          }
        }
      `,
    });

    await page.setViewport({
      width: PRINT_WIDTH_PX,
      height: heightPx,
      deviceScaleFactor: 1,
    });

    // Explicit paper size forces PDF MediaBox; avoids Chromium keeping a prior huge @page size.
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      preferCSSPageSize: false,
      width: `${PRINT_WIDTH_PX}px`,
      height: `${heightPx}px`,
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
