import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { hasDb } from "@/lib/db";
import { getValidCampSlugs } from "@/lib/directory-camps";
import { campUsesReservations } from "@/lib/reservation-camps";
import { isValidDateRange } from "@/lib/camp-capacity";
import { isIsoDate } from "@/lib/director-season-totals";
import {
  computeSeasonTotalsFromDb,
  listSeasonTotalSnapshots,
  upsertSeasonTotalSnapshot,
} from "@/lib/director-season-totals-db";

/**
 * GET /api/members/caretaker/admin/season-totals?campSlug=&seasonFrom=&seasonTo=
 * List saved Season Totals snapshots for a camp/season.
 *
 * POST body: { campSlug, seasonFrom, seasonTo, snapshotDate }
 * Compute and upsert a snapshot for the as-of date.
 */
export async function GET(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const campSlug = request.nextUrl.searchParams.get("campSlug")?.trim() ?? "";
  const seasonFrom = request.nextUrl.searchParams.get("seasonFrom")?.trim() ?? "";
  const seasonTo = request.nextUrl.searchParams.get("seasonTo")?.trim() ?? "";

  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }
  if (!campUsesReservations(campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }
  if (!isValidDateRange(seasonFrom, seasonTo)) {
    return NextResponse.json(
      { error: "Valid seasonFrom and seasonTo required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const snapshots = await listSeasonTotalSnapshots({ campSlug, seasonFrom, seasonTo });
    return NextResponse.json(
      { campSlug, seasonFrom, seasonTo, snapshots },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[season-totals GET]", e);
    return NextResponse.json({ error: "Failed to load season totals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  let body: {
    campSlug?: string;
    seasonFrom?: string;
    seasonTo?: string;
    snapshotDate?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const campSlug = body.campSlug?.trim() ?? "";
  const seasonFrom = body.seasonFrom?.trim() ?? "";
  const seasonTo = body.seasonTo?.trim() ?? "";
  const snapshotDate = body.snapshotDate?.trim() ?? "";

  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }
  if (!campUsesReservations(campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }
  if (!isValidDateRange(seasonFrom, seasonTo)) {
    return NextResponse.json(
      { error: "Valid seasonFrom and seasonTo required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (!isIsoDate(snapshotDate)) {
    return NextResponse.json({ error: "Valid snapshotDate required (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const computed = await computeSeasonTotalsFromDb({
      campSlug,
      seasonFrom,
      seasonTo,
      snapshotDate,
    });
    const { campName, bookableSiteCount, ...metrics } = computed;
    const snapshot = await upsertSeasonTotalSnapshot({
      campSlug,
      seasonFrom,
      seasonTo,
      snapshotDate,
      metrics,
      generatedByContactId: access.contactId ?? null,
    });

    return NextResponse.json(
      {
        campName,
        bookableSiteCount,
        snapshot,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[season-totals POST]", e);
    const message = e instanceof Error ? e.message : "Failed to compute season totals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
