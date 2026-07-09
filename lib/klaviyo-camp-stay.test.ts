import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCampStayProfileProperties } from "./klaviyo-camp-stay.ts";

describe("buildCampStayProfileProperties", () => {
  it("sets upcoming reservation fields when status is reserved", () => {
    const props = buildCampStayProfileProperties(
      {
        email: "guest@example.com",
        campSlug: "oconee-south-carolina",
        checkInDate: "2026-08-10",
        checkOutDate: "2026-08-15",
        status: "reserved",
        lastStayAs: "guest",
        nights: 5,
        campName: "Oconee",
      },
      {},
      "2026-07-01"
    );
    assert.equal(props["Next Camp Booked"], "oconee-south-carolina");
    assert.equal(props["Next Camp Booked Name"], "Oconee");
    assert.equal(props["Reservation Start Date"], "2026-08-10");
    assert.equal(props["Reservation End Date"], "2026-08-15");
    assert.equal(props["Reservation Nights"], 5);
    assert.equal(props["Most Recent Stay Status"], "reserved");
  });

  it("clears next camp booked when reservation is cancelled", () => {
    const props = buildCampStayProfileProperties(
      {
        email: "guest@example.com",
        campSlug: "stanton-arizona",
        checkInDate: "2026-08-10",
        checkOutDate: "2026-08-15",
        status: "cancelled",
        lastStayAs: "guest",
      },
      {
        "Next Camp Booked": "stanton-arizona",
        "Next Camp Booked Name": "Stanton",
        "Reservation Start Date": "2026-08-10",
      },
      "2026-07-01"
    );
    assert.equal(props["Next Camp Booked"], "");
    assert.equal(props["Next Camp Booked Name"], "");
  });

  it("merges camps stayed without dropping existing camps", () => {
    const props = buildCampStayProfileProperties(
      {
        email: "guest@example.com",
        campSlug: "blue-bucket-oregon",
        checkInDate: "2026-09-01",
        checkOutDate: "2026-09-05",
        status: "completed",
        lastStayAs: "member",
      },
      { "Camps Stayed": "stanton-arizona" },
      "2026-09-10"
    );
    assert.equal(props["Camps Stayed"], "stanton-arizona, blue-bucket-oregon");
    assert.equal(props["Most Recent Check In"], "2026-09-01");
  });
});
