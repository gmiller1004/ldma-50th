# Klaviyo Camp Stay Remarketing

Camp reservations and check-ins (member + guest) are synced to Klaviyo so you can run remarketing flows (e.g. “thank you for staying at Burnt River”, Dirt Fest offers, multi-camp campaigns).

## Env

- `KLAVIYO_PRIVATE_API_KEY` – same key as newsletter; needs `profiles:read` and `profiles:write`.

## Create vs update

Klaviyo’s **Create or Update Profile** (POST /api/profile-import) is used with no profile `id`. If no profile exists for the given email, Klaviyo **creates** a new profile. If one exists, it is updated. On each sync we also call **ensure email marketing subscribe** when the profile is not already `SUBSCRIBED` (via `profile-subscription-bulk-create-jobs`, same list as newsletter when `KLAVIYO_LIST_ID` is set).

New profiles are created with:

- **Email** – from the reservation/check-in (guest email or member email from Salesforce lookup).
- **First name / Last name** – for **members**: from Salesforce (`lookupMember` returns `FirstName`, `LastName`). For **guests**: from the reservation or guest check-in form (`guest_first_name`, `guest_last_name` or `first_name`, `last_name`).
- **Custom properties** – Most Recent Camp, Most Recent Stay Status, Most Recent Check Out, Camps Stayed (see below).

## Profile custom properties

Each profile is created or updated with these **custom properties** (under “Properties” in Klaviyo):

| Property | Type | Description |
|----------|------|-------------|
| **Most Recent Camp** | string | Camp slug of their latest stay (e.g. `burnt-river-oregon`). |
| **Most Recent Camp Name** | string | Display name of their latest camp. |
| **Most Recent Stay Status** | string | One of: `reserved`, `in_progress`, `cancelled`, `completed`. |
| **Most Recent Stay Type** | string | Whether they were a **member** or **guest** at the time of their last stay. |
| **Most Recent Check In** | string | Check-in date of latest stay (YYYY-MM-DD). |
| **Most Recent Check Out** | string | Check-out date of latest stay (YYYY-MM-DD). |
| **Next Camp Booked** | string | Camp slug when they have an upcoming reservation (`reserved`, check-out not passed). Cleared on cancel/complete/check-in. |
| **Next Camp Booked Name** | string | Display name for the upcoming booked camp. |
| **Reservation Start Date** | string | Start date of the reservation being synced (YYYY-MM-DD). |
| **Reservation End Date** | string | End date of the reservation being synced (YYYY-MM-DD). |
| **Reservation Nights** | number | Night count for the reservation being synced. |
| **Camps Stayed** | string | Comma-separated list of all camps they’ve stayed at (no overwrite when they stay at a different camp). |

Standard profile fields (email, first name, last name) are also set when we have them.

## When we sync

- **Reservation created** (caretaker or Stripe) → status `reserved`.
- **Reservation updated** (dates or check-in) → current status (`reserved` or `in_progress`).
- **Reservation cancelled** → status `cancelled`.
- **Reservation thank-you sent** (cron) → status `completed` and DB status set to completed.
- **Member check-in created** → status `in_progress` or `completed` (if check-out date already passed).
- **Guest check-in created** → same as above.

## Building flows in Klaviyo

- **Segment:** “Next Camp Booked” is not empty → has an upcoming reservation (pre-arrival remarketing).
- **Segment:** “Most Recent Stay Status” equals `reserved` and “Reservation Start Date” is in the future → booked but not yet arrived.
- **Segment:** “Most Recent Stay Status” equals `completed` → everyone who finished a stay.
- **Segment:** “Most Recent Stay Type” equals `guest` → last stay was as a guest (e.g. for membership conversion).
- **Segment:** “Most Recent Camp” equals `burnt-river-oregon` and “Most Recent Stay Status” equals `completed` → completed a stay at Burnt River (e.g. for Dirt Fest Burnt River).
- **Segment:** “Camps Stayed” contains more than one camp (e.g. string contains a comma) → multi-camp visitors.
- Use “Most Recent Check Out” for timing (e.g. trigger flow 7 days after that date).

Flows can be triggered by “Profile property updated” and filters on these properties.
