/**
 * Camp site capacity for a date range: booked vs available bookable sites.
 */

import { addDays, countNights } from "@/lib/reservation-dates";

export type CampCapacityStats = {
  totalSites: number;
  bookedSites: number;
  availableSites: number;
  bookedPercent: number;
  availablePercent: number;
};

export type SiteNightOccupancyStats = {
  rangeNights: number;
  totalSiteNights: number;
  bookedSiteNights: number;
  availableSiteNights: number;
  bookedPercent: number;
  availablePercent: number;
};

export type StayOverlapInput = {
  siteId: string;
  checkIn: string;
  checkOut: string;
};

/** Nights in an inclusive calendar range (from through to). */
export function nightsInInclusiveRange(from: string, to: string): number {
  return countNights(from, addDays(to, 1));
}

/** Nights a stay overlaps an inclusive range. Stay and range use checkout-exclusive end dates. */
export function overlapNights(
  stayCheckIn: string,
  stayCheckOut: string,
  rangeFrom: string,
  rangeTo: string
): number {
  const rangeEndExclusive = addDays(rangeTo, 1);
  const overlapStart = stayCheckIn > rangeFrom ? stayCheckIn : rangeFrom;
  const overlapEnd = stayCheckOut < rangeEndExclusive ? stayCheckOut : rangeEndExclusive;
  if (overlapEnd <= overlapStart) return 0;
  return countNights(overlapStart, overlapEnd);
}

/**
 * Site-night occupancy: booked site-nights ÷ (total sites × nights in range).
 * Partial-week stays contribute proportionally; per-site nights capped at range length.
 */
export function computeSiteNightOccupancy(
  totalSites: number,
  rangeFrom: string,
  rangeTo: string,
  stays: StayOverlapInput[]
): SiteNightOccupancyStats {
  const rangeNights = nightsInInclusiveRange(rangeFrom, rangeTo);
  const totalSiteNights = totalSites * rangeNights;

  if (totalSites <= 0 || rangeNights <= 0) {
    return {
      rangeNights,
      totalSiteNights: 0,
      bookedSiteNights: 0,
      availableSiteNights: 0,
      bookedPercent: 0,
      availablePercent: 0,
    };
  }

  const nightsBySite = new Map<string, number>();
  for (const stay of stays) {
    const nights = overlapNights(stay.checkIn, stay.checkOut, rangeFrom, rangeTo);
    if (nights <= 0) continue;
    const prev = nightsBySite.get(stay.siteId) ?? 0;
    nightsBySite.set(stay.siteId, Math.min(rangeNights, prev + nights));
  }

  let bookedSiteNights = 0;
  for (const nights of nightsBySite.values()) {
    bookedSiteNights += nights;
  }
  bookedSiteNights = Math.min(bookedSiteNights, totalSiteNights);
  const availableSiteNights = totalSiteNights - bookedSiteNights;
  const bookedPercent = Math.round((bookedSiteNights / totalSiteNights) * 1000) / 10;
  const availablePercent = Math.round((availableSiteNights / totalSiteNights) * 1000) / 10;

  return {
    rangeNights,
    totalSiteNights,
    bookedSiteNights,
    availableSiteNights,
    bookedPercent,
    availablePercent,
  };
}

/** Parse YYYY-MM into inclusive from/to date strings for that calendar month. */
export function monthDateRange(monthValue: string): { from: string; to: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthValue.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function currentMonthValue(today = new Date()): string {
  return today.toLocaleDateString("en-CA").slice(0, 7);
}

export function computeCapacityStats(bookedSites: number, totalSites: number): CampCapacityStats {
  const booked = Math.max(0, Math.min(bookedSites, totalSites));
  const total = Math.max(0, totalSites);
  if (total === 0) {
    return {
      totalSites: 0,
      bookedSites: 0,
      availableSites: 0,
      bookedPercent: 0,
      availablePercent: 0,
    };
  }
  const availableSites = total - booked;
  const bookedPercent = Math.round((booked / total) * 1000) / 10;
  const availablePercent = Math.round((availableSites / total) * 1000) / 10;
  return {
    totalSites: total,
    bookedSites: booked,
    availableSites,
    bookedPercent,
    availablePercent,
  };
}

export function isValidDateRange(from: string, to: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
}

/** Inclusive calendar dates from `from` through `to` (YYYY-MM-DD). */
export function enumerateInclusiveDates(from: string, to: string): string[] {
  if (!isValidDateRange(from, to)) return [];
  const dates: string[] = [];
  let cur = from;
  while (cur <= to) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

export type SiteNightGridSite = {
  id: string;
  name: string;
};

export type SiteNightGridRow = {
  siteId: string;
  siteName: string;
  /** Parallel to `dates`: true when the site is occupied that night. */
  booked: boolean[];
};

/**
 * Build a site × date occupancy matrix.
 * A night D is booked when some stay has checkIn <= D < checkOut (checkout exclusive).
 */
export function buildSiteNightOccupancyGrid(
  sites: SiteNightGridSite[],
  dates: string[],
  stays: StayOverlapInput[]
): SiteNightGridRow[] {
  const staysBySite = new Map<string, StayOverlapInput[]>();
  for (const stay of stays) {
    const list = staysBySite.get(stay.siteId);
    if (list) list.push(stay);
    else staysBySite.set(stay.siteId, [stay]);
  }

  return sites.map((site) => {
    const siteStays = staysBySite.get(site.id) ?? [];
    const booked = dates.map((date) =>
      siteStays.some((stay) => stay.checkIn <= date && date < stay.checkOut)
    );
    return { siteId: site.id, siteName: site.name, booked };
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Excel SpreadsheetML workbook: sites as rows, dates as columns,
 * booked nights as yellow cells with "x". Opens in Excel / compatible apps.
 * (Plain CSV cannot carry cell fill colors.)
 */
export function buildSiteNightOccupancySpreadsheetXml(input: {
  campName: string;
  from: string;
  to: string;
  dates: string[];
  rows: SiteNightGridRow[];
}): string {
  const { campName, from, to, dates, rows } = input;
  const headerCells = [
    `<Cell ss:StyleID="Header"><Data ss:Type="String">Site</Data></Cell>`,
    ...dates.map(
      (d) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(d)}</Data></Cell>`
    ),
  ].join("");

  const body = rows
    .map((row) => {
      const cells = [
        `<Cell ss:StyleID="Site"><Data ss:Type="String">${escapeXml(row.siteName)}</Data></Cell>`,
        ...row.booked.map((isBooked) =>
          isBooked
            ? `<Cell ss:StyleID="Booked"><Data ss:Type="String">x</Data></Cell>`
            : `<Cell ss:StyleID="Empty"><Data ss:Type="String"></Data></Cell>`
        ),
      ].join("");
      return `<Row>${cells}</Row>`;
    })
    .join("\n");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${escapeXml(`${campName} site-night occupancy ${from} to ${to}`)}</Title>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Interior ss:Color="#F5E6C8" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Site">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Booked">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Interior ss:Color="#FFFF00" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="Empty">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Occupancy">
  <Table>
   <Column ss:Width="180"/>
${dates.map(() => `   <Column ss:Width="56"/>`).join("\n")}
   <Row>${headerCells}</Row>
${body}
  </Table>
 </Worksheet>
</Workbook>
`;
}

/** Plain CSV twin (x / blank). Useful when yellow fill is not needed. */
export function buildSiteNightOccupancyCsv(dates: string[], rows: SiteNightGridRow[]): string {
  const escape = (s: string) => {
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    ["Site", ...dates].map(escape).join(","),
    ...rows.map((row) =>
      [escape(row.siteName), ...row.booked.map((b) => (b ? "x" : ""))].join(",")
    ),
  ];
  return lines.join("\n") + "\n";
}
