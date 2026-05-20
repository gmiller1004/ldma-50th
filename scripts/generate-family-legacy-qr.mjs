import QRCode from "qrcode";
import fs from "node:fs/promises";
import path from "node:path";

const url = "https://myldma.com/family-legacy";
const outPath = path.join(process.cwd(), "public", "images", "family-legacy-qr.png");

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

