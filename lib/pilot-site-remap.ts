/**
 * Map pilot camp_sites.name (pre-master) → master site_code for Burnt River & Vein Mountain.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { extractSiteCode } from "@/lib/resnexus-import";

const OVERRIDE_CSV = join(process.cwd(), "data/camp-reservations/pilot-site-remap.csv");

let overrideCache: Map<string, string> | null = null;

function overrideKey(campSlug: string, pilotName: string): string {
  return `${campSlug}::${pilotName.trim().toLowerCase()}`;
}

export function loadPilotSiteOverrides(csvPath = OVERRIDE_CSV): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(csvPath)) return map;
  const lines = readFileSync(csvPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split(",");
    if (parts.length < 3) continue;
    const campSlug = parts[0].trim();
    const pilotName = parts[1].trim();
    const siteCode = parts[2].trim();
    if (campSlug && pilotName && siteCode) {
      map.set(overrideKey(campSlug, pilotName), siteCode);
    }
  }
  return map;
}

function getOverrides(): Map<string, string> {
  if (!overrideCache) overrideCache = loadPilotSiteOverrides();
  return overrideCache;
}

/** Clear override cache (tests). */
export function clearPilotSiteOverrideCache(): void {
  overrideCache = null;
}

export function pilotSiteNameToCode(campSlug: string, pilotSiteName: string): string | null {
  const name = pilotSiteName.trim();
  if (!name) return null;

  const override = getOverrides().get(overrideKey(campSlug, name));
  if (override) return override;

  if (campSlug === "vein-mountain-north-carolina") {
    const lower = /^Lower\s+(\d+)$/i.exec(name);
    if (lower) return `LC-${lower[1].padStart(2, "0")}`;

    const upper = /^Upper\s+(\d+)$/i.exec(name);
    if (upper) return `UC-${upper[1].padStart(2, "0")}`;

    const overflow = /^Overflow\s+(\d+)$/i.exec(name);
    if (overflow) {
      const n = parseInt(overflow[1], 10);
      if (n >= 1 && n <= 5) return `LC-${20 + n}`;
    }
    return null;
  }

  if (campSlug === "burnt-river-oregon") {
    const hookup = /^Hookup\s+Site\s+(\d+)$/i.exec(name);
    if (hookup) return String(parseInt(hookup[1], 10));

    const dry = /^Dry\s+Site\s+(\d+)$/i.exec(name);
    if (dry) {
      const n = parseInt(dry[1], 10);
      if (n >= 1 && n <= 30) return `D${n}`;
      return null;
    }

    const siteNum = /^Site\s+(\d+)$/i.exec(name);
    if (siteNum) return String(parseInt(siteNum[1], 10));

    if (/^D\d+$/i.test(name)) {
      const n = parseInt(name.slice(1), 10);
      return `D${n}`;
    }

    if (/^\d+$/.test(name)) return String(parseInt(name, 10));

    return extractSiteCode(name);
  }

  return null;
}

export const PILOT_REMAP_CAMP_SLUGS = ["burnt-river-oregon", "vein-mountain-north-carolina"] as const;
