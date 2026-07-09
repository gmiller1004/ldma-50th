import QRCode from "qrcode";
import fs from "node:fs/promises";
import path from "node:path";

const url = "https://myldma.com/cart/7579322581063:1?discount=CompleteLegacy50thMail";
const outPath = path.join(
  process.cwd(),
  "public",
  "images",
  "family-legacy-complete-bundle-qr.png"
);

await fs.mkdir(path.dirname(outPath), { recursive: true });

await QRCode.toFile(outPath, url, {
  type: "png",
  width: 900,
  margin: 1,
  errorCorrectionLevel: "M",
  color: {
    dark: "#000000",
    light: "#FFFFFF",
  },
});

console.log(`Wrote ${outPath}`);
console.log(`URL: ${url}`);
