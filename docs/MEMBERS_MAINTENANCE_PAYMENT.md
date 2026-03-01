# Maintenance Payment — Variable Amount Setup

The member profile can show a "Make a payment" link when a member has dues owed. The link includes the amount as a query parameter (`?amount=75.00`) so the payment page can pre-fill the amount.

## Env variable

```
MEMBER_MAINTENANCE_PAYMENT_URL=https://your-site.com/maintenance-payment
```

If not set, the profile shows "call to make a payment" instead of a link.

## Options for variable-amount payment

### Option 1: Stripe Payment Link

Use Stripe to create a payment link that accepts a custom amount:

1. Create a Stripe Payment Link (one-time payment).
2. Use Stripe's `prefilled_email` and **line items with dynamic amount** — Stripe Payment Links support `{CHECKOUT_SESSION_AMOUNT}` or you can create links via the API per request.
3. Or: create an API route that calls Stripe's API to create a Checkout Session with the exact amount, then redirects to the session URL. This requires a backend route that uses the Stripe SDK.

**Example API approach:** `/api/members/create-payment-link` accepts the amount, creates a Stripe Checkout Session, returns the URL. The profile would call this (or redirect through it) instead of using a static URL.

### Option 2: Shopify product with custom amount

Shopify does not natively support "name your price" in the cart. Options:

- **Shopify app** – Use an app like "Custom Amount" or "Donation" that allows variable pricing. Configure the product to read `amount` from the URL.
- **Draft Order** – Create a server-side API that uses Shopify Admin API to create a Draft Order with a line item for the exact amount, then redirect to the draft order's checkout URL. Requires Shopify Admin API access (not Storefront).

### Option 3: External payment form

Create a simple page (on your site or a third-party) that:
- Accepts `?amount=75.00` in the URL
- Pre-fills an amount input
- Submits to PayPal, Stripe, or your processor

Host it and set `MEMBER_MAINTENANCE_PAYMENT_URL` to that page.

### Option 4: Fixed-amount product

Create a Shopify product "Maintenance Dues Payment" with variants for common amounts ($25, $50, $100, $200). Link to the product; the member picks the closest variant. No env var needed beyond the product URL — but the amount won't match exactly.

---

## Recommended: Stripe Checkout Session API

For exact amounts, an API route that creates a Stripe Checkout Session is the most straightforward:

1. Install `stripe` package
2. Create `POST /api/members/create-payment-link` that:
   - Verifies the member is logged in
   - Reads `amount` from the request (from their dues)
   - Creates a Stripe Checkout Session with that amount
   - Returns the session URL
3. The profile "Make a payment" link calls this API and redirects to the returned URL

This requires Stripe API keys and a success/cancel URL for the checkout.
