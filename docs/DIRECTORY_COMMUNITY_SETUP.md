# Directory & Community Setup (Phases 3 & 4)

This document explains how to set up the camp directory and community features (discussions, comments). The community is **public during development**; you can gate it behind members-only access when ready.

## Database (Neon / Postgres)

Vercel Postgres has been deprecated. Use **Neon** (or another Postgres provider) via the [Vercel Marketplace](https://vercel.com/marketplace?category=storage&search=postgres).

### 1. Add Neon to your Vercel project

1. Go to your Vercel project → **Storage** → **Create Database**
2. Choose **Neon** (or another Postgres integration)
3. Connect it to your project — this injects `POSTGRES_URL` (or `DATABASE_URL`)

### 2. Run the schema

After connecting, run the SQL in `scripts/init-community-db.sql` against your database:

- **Option A:** In Neon dashboard → SQL Editor → paste and run the script
- **Option B:** Use `psql` or any Postgres client with your connection string

### 3. Local development

Add to `.env.local`:

```
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
```

Or `DATABASE_URL` — the app checks both. Get the connection string from your Neon dashboard.

## Environment variables

| Variable        | Required | Description                          |
|-----------------|----------|--------------------------------------|
| `POSTGRES_URL`  | Yes*     | Postgres connection string (Neon)   |
| `DATABASE_URL`  | Yes*     | Alternative to POSTGRES_URL         |
| `BLOB_READ_WRITE_TOKEN` | No** | Vercel Blob for photo uploads       |

\* One of `POSTGRES_URL` or `DATABASE_URL` is required for community features.  
\** Required only when you add photo uploads (Vercel Blob).

## Routes

| Route                          | Description                    |
|--------------------------------|--------------------------------|
| `/directory`                   | Camp directory listing         |
| `/directory/[slug]`            | Camp community (discussions)   |
| `/directory/[slug]/c/[claimSlug]` | Claim-specific discussions (e.g. Stanton) |
| `/directory/[slug]/d/[id]`     | Discussion thread + replies    |

## Member gating

The directory is gated behind members-only access:

- Middleware (`middleware.ts`) protects `/directory` and all sub-routes
- Unauthenticated users are redirected to `/members/login?redirect=/directory` (or the path they tried)
- After login, users are sent back to the original URL
- Directory is accessible from the Members dashboard and MembersNav (Profile, Directory, Sign out)

To tie posts to members: pass `author_member_id` from the session when creating discussions/comments, and sync `community_members` from Salesforce on login.

## Migrations

After the initial schema, run migrations for new features:

```bash
npm run db:migrate
```

This adds `author_contact_id` (for edit permission), `community_reactions` (thumbs up/down), and indexes.

## Data model

- **community_members** — Synced when members log in; used for attribution
- **community_discussions** — Trip reports, camp updates; each starts a thread
- **community_comments** — Nested replies on discussions
- **community_reactions** — Thumbs up/down per user per discussion or comment (for sorting: most liked, most engagement)
- **community_photos** — Vercel Blob URLs (when photo uploads are added)
- **community_video_links** — YouTube/Vimeo embed URLs (when video support is added)
