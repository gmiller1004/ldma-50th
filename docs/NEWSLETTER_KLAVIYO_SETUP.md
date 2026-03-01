# Newsletter / Klaviyo Setup

The homepage newsletter signup uses a **custom form** that submits to Klaviyo via our API. This approach works reliably with Next.js client-side navigation (unlike Klaviyo’s embed forms, which break on SPA navigation).

## Setup

1. **Create a Klaviyo Private API Key**
   - In Klaviyo: **Settings** → **API Keys** → **Create Private API Key**
   - Give it a name (e.g. “LDMA 50th Newsletter”)
   - Scopes: `lists:write`, `profiles:write`, `subscriptions:write`

2. **Add to environment**
   - `KLAVIYO_PRIVATE_API_KEY` – your private API key

3. **Optional: List ID**
   - If you want subscribers added to a specific list, set `KLAVIYO_LIST_ID`
   - Find the list ID in Klaviyo under **Audience** → **Lists** → open list → ID in the URL or settings
   - If omitted, Klaviyo uses the account’s default opt-in list

## Behavior

- Subscribers are added via Klaviyo’s Subscribe Profiles API (revision 2024-05-15)
- Single vs double opt-in depends on your list (or account) settings
- `custom_source` is set to `"LDMA 50th Website"` for tracking
