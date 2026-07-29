import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterAndSortReservations,
  reservationPartyLabel,
  type ReservationListQueryRow,
} from "./caretaker-reservation-list-query.ts";

function row(partial: Partial<ReservationListQueryRow> & Pick<ReservationListQueryRow, "id">): ReservationListQueryRow {
  return {
    checkInDate: "2026-07-01",
    checkOutDate: "2026-07-10",
    reservationType: "member",
    status: "reserved",
    ...partial,
  };
}

describe("reservationListQuery", () => {
  it("labels members and guests", () => {
    assert.equal(
      reservationPartyLabel(row({ id: "1", memberDisplayName: "RICHARD SPEIDEL" })),
      "RICHARD SPEIDEL"
    );
    assert.equal(
      reservationPartyLabel(
        row({
          id: "2",
          reservationType: "guest",
          guestFirstName: "Jane",
          guestLastName: "Doe",
        })
      ),
      "Jane Doe"
    );
  });

  it("filters by name tokens and sorts by name", () => {
    const rows = [
      row({ id: "a", memberDisplayName: "RICHARD SPEIDEL", siteName: "132", checkInDate: "2026-08-01" }),
      row({ id: "b", memberDisplayName: "Benjamin Adams", siteName: "32", checkInDate: "2026-07-01" }),
      row({
        id: "c",
        reservationType: "guest",
        guestFirstName: "Rich",
        guestLastName: "Smith",
        siteName: "10",
        checkInDate: "2026-07-15",
      }),
    ];

    const filtered = filterAndSortReservations(rows, {
      search: "rich",
      filter: "all",
      sortKey: "name",
      sortDir: "asc",
    });
    assert.deepEqual(
      filtered.map((r) => r.id),
      ["c", "a"]
    );
  });

  it("filters balance due and sorts by check-in", () => {
    const rows = [
      row({ id: "paid", memberDisplayName: "A", balanceDueCents: 0, checkInDate: "2026-07-01" }),
      row({ id: "due", memberDisplayName: "B", balanceDueCents: 5000, checkInDate: "2026-07-10" }),
      row({ id: "also", memberDisplayName: "C", balanceDueCents: 100, checkInDate: "2026-07-05" }),
    ];
    const filtered = filterAndSortReservations(rows, {
      search: "",
      filter: "balanceDue",
      sortKey: "checkIn",
      sortDir: "asc",
    });
    assert.deepEqual(
      filtered.map((r) => r.id),
      ["also", "due"]
    );
  });
});
