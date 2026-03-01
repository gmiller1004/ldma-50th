# Comment Digest Notifications

Members can opt in to receive a daily email recap when someone comments on their community posts. The email is sent at **8pm Pacific** (4am UTC) and **only when there has been activity** that day.

## Setup

### 1. Environment variables

Add to Vercel (and `.env.local` for local testing):

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Secret for authenticating cron requests. Generate a random string (e.g. `openssl rand -hex 32`). Vercel passes this as `Authorization: Bearer <CRON_SECRET>` when invoking the cron. |
| `NEXT_PUBLIC_SITE_URL` | (Optional) Base URL for links in emails, e.g. `https://ldma50.com`. Falls back to `https://<VERCEL_URL>` if not set. |
| `SENDGRID_API_KEY` | Required for sending emails. Same as used for login codes. |
| `SENDGRID_FROM_EMAIL` | Sender address for digest emails. |
| `SENDGRID_FROM_NAME` | Sender name (e.g. "LDMA"). |

### 2. Vercel Cron

The cron is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/comment-digest",
      "schedule": "0 4 * * *"
    }
  ]
}
```

- Schedule: `0 4 * * *` = 4:00 UTC daily ≈ 8pm Pacific (PST). In PDT it runs ~9pm Pacific.
- Vercel automatically invokes the route and includes the `Authorization: Bearer <CRON_SECRET>` header when `CRON_SECRET` is set.

### 3. Manual test

To test the digest logic without waiting for the cron:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-site.vercel.app/api/cron/comment-digest
```

Returns `{ ok: true, sent: N, skipped: M, total: T }`.

### 4. Database

The `member_notification_preferences` table is created by `npm run db:migrate`. It stores `member_number` and `comment_digest_enabled`.

## Flow

1. Member enables "Email me a daily recap" in **Profile → Notifications**.
2. Daily at 8pm Pacific, the cron runs.
3. For each opted-in member: finds discussions they authored that received comments today (excluding their own).
4. If activity exists: sends a digest email with discussion titles, comment snippets, and links to reply.
5. If no activity: no email is sent.
