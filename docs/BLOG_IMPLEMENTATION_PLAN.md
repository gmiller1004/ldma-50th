# Blog + Admin Portal — Implementation Plan

## 1. Overview

Add a blog to the LDMA site with:
- Postgres storage (existing Neon)
- Admin portal at `/admin/blog` gated by LDMA admins (Salesforce `Is_LDMA_Admin__c = true` on Contact)
- Public blog at `/blog` with category filters, similar posts, featured links, and sharing

**Note:** Salesforce is already configured for member login. Add custom field `Is_LDMA_Admin__c` to Contact and set to true on your record to access the blog editor.

---

## 2. Salesforce Changes

**Add custom field:**
- **Field API Name:** `Is_LDMA_Admin__c`
- **Type:** Checkbox
- **Label:** Is LDMA Admin
- **Purpose:** When checked, the member can access the blog admin portal

**Update `lookupMember` in `lib/salesforce.ts`:**
1. Add `Is_LDMA_Admin__c` to the Contact SELECT
2. Add `isLdmaAdmin: boolean` to `MemberLookupResult`
3. Map the field: `isLdmaAdmin: c.Is_LDMA_Admin__c === true`

---

## 3. Database Schema

**Migration:** `scripts/init-blog-db.sql` (run once)

```sql
-- Blog categories (fixed list, seeded)
CREATE TABLE IF NOT EXISTS blog_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- Seed fixed categories
INSERT INTO blog_categories (id, label, sort_order) VALUES
  ('camp-life', 'Camp Life', 1),
  ('events', 'Events', 2),
  ('mining-gear', 'Mining Gear', 3),
  ('ldma-history', 'LDMA History', 4),
  ('prospecting-tips', 'Prospecting Tips', 5),
  ('member-stories', 'Member Stories', 6)
ON CONFLICT (id) DO NOTHING;

-- Blog posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES blog_categories(id),
  featured_image_url TEXT,
  author_contact_id TEXT,
  author_display_name TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_updated ON blog_posts(updated_at DESC);
```

---

## 4. File Structure

```
app/
├── blog/
│   ├── page.tsx                    # Blog index: list posts, category filter
│   ├── [slug]/
│   │   └── page.tsx                # Single post
│   └── layout.tsx                  # Shared layout, breadcrumbs
├── admin/
│   └── blog/
│       ├── layout.tsx              # Admin layout, auth guard, nav
│       ├── page.tsx                # List posts (draft + published)
│       ├── new/
│       │   └── page.tsx            # Create post
│       └── [id]/
│           └── edit/
│               └── page.tsx        # Edit post
lib/
├── blog.ts                         # getPosts, getPostBySlug, getSimilarPosts, createPost, updatePost
├── blog-admin.ts                   # requireAdmin(), check isLdmaAdmin
app/api/
├── blog/
│   ├── route.ts                    # GET: list posts (public)
│   └── [slug]/
│       └── route.ts                # GET: single post (public)
├── admin/
│   └── blog/
│       ├── route.ts                # POST: create post (admin only)
│       ├── [id]/
│       │   └── route.ts            # PATCH, DELETE (admin only)
│       └── upload/
│           └── route.ts            # POST: featured image upload (admin only)
components/
├── BlogPostCard.tsx
├── BlogPostContent.tsx             # Renders body, ShareButton, SimilarPosts, FeaturedLinks
├── FeaturedLinks.tsx               # Membership, Events, Shop, Campgrounds, 50 Years
├── SimilarPosts.tsx
└── admin/
    └── BlogPostForm.tsx            # Title, slug, excerpt, body, category, featured image
```

---

## 5. Auth & Admin Access

**`lib/blog-admin.ts`:**
- `getAdminMember()`: verify session, lookup member, return member if `isLdmaAdmin` else null
- `requireAdmin()`: call getAdminMember, if null return 403 Response

**Flow:**
1. Read `member_session` cookie
2. Verify JWT via `verifySessionToken`
3. Call `lookupMember(session.memberNumber)` from Salesforce
4. If `member.isLdmaAdmin !== true` → 403

**`/api/members/me`:** Include `isLdmaAdmin: boolean` in the response so frontend can show/hide Admin link.

**Admin routes:** All `/admin/blog/*` pages and `/api/admin/blog/*` APIs use `requireAdmin()`.

**Navbar:** If `authenticated && isLdmaAdmin`, show "Admin" or "Blog Admin" link.

---

## 6. Admin Portal

**Routes:**
- `/admin/blog` — List all posts (table or cards), status (draft/published), edit/delete
- `/admin/blog/new` — Create post form
- `/admin/blog/[id]/edit` — Edit post form

**Form fields:**
- Title
- Slug (auto-derived from title, editable)
- Excerpt
- Category (select from `blog_categories`)
- Body (textarea for Markdown or simple HTML; optionally TipTap/Lexical later)
- Featured image: file upload → Vercel Blob → store URL
- Publish checkbox or "Publish" vs "Save draft" (`published_at` null = draft)

**Image upload:**
- `POST /api/admin/blog/upload` with multipart form
- Use `put()` from `@vercel/blob` (path: `blog/${postId || 'draft'}-${timestamp}.${ext}`)
- Return `{ url }` for form

---

## 7. Public Blog

**`/blog`:**
- List published posts (`published_at IS NOT NULL`, `ORDER BY published_at DESC`)
- Filter by category (query param `?category=camp-life`)
- Pagination or "Load more" (e.g. 12 per page)
- Match site styling (gold/brown palette, serif headings)

**`/blog/[slug]`:**
- Fetch post by slug
- 404 if not found or not published
- Render: title, excerpt, body, category badge, date, author (if set)
- Components:
  - **ShareButton** (reuse existing) with post URL, title, excerpt
  - **SimilarPosts** — same category, exclude current, limit 3–4
  - **FeaturedLinks** — Membership, Events, Shop, Campgrounds, 50 Years

**Metadata:** `generateMetadata` for each post (og:title, og:description, og:image from featured image or default).

---

## 8. Similar Posts

**Logic in `lib/blog.ts`:**
```ts
getSimilarPosts(postId: string, categoryId: string, limit = 4): Promise<BlogPost[]>
// WHERE category_id = $1 AND id != $2 AND published_at IS NOT NULL
// ORDER BY published_at DESC LIMIT $3
```

---

## 9. Featured Links Component

**`FeaturedLinks.tsx`:**
- Fixed links: Membership, Events, Shop, Campgrounds, 50 Years
- Card or compact list
- Shown in blog post sidebar or below content

---

## 10. Categories

- Fixed list in `blog_categories` table, seeded
- Admin form: dropdown
- Blog index: category pills/tabs for filtering
- URL: `/blog?category=camp-life`

---

## 11. Body Content

**Phase 1:** Plain Markdown or HTML in textarea
- Store in `body`
- Render with `dangerouslySetInnerHTML` (HTML) or `react-markdown` (Markdown)

**Phase 2 (optional):** Rich editor (TipTap, Lexical) for WYSIWYG

---

## 12. Implementation Order

| Phase | Task | Est. |
|-------|------|------|
| 1 | Salesforce: add `Is_LDMA_Admin__c`, update `lookupMember` | 30 min |
| 2 | DB: migration script, run against Neon | 15 min |
| 3 | `lib/blog.ts` — CRUD + similar posts | 1 hr |
| 4 | `lib/blog-admin.ts` — requireAdmin | 30 min |
| 5 | `/api/members/me` — include `isLdmaAdmin` | 15 min |
| 6 | Admin API: create, update, delete, upload | 1 hr |
| 7 | Admin UI: list, new, edit forms | 2 hr |
| 8 | Public API: list, get by slug | 30 min |
| 9 | Public blog: index page, post page | 1.5 hr |
| 10 | Components: SimilarPosts, FeaturedLinks, ShareButton integration | 1 hr |
| 11 | Navbar: Blog link, Admin link (when isLdmaAdmin) | 30 min |
| 12 | Metadata/SEO for blog pages | 30 min |

**Total:** ~9–10 hours

---

## 13. Dependencies

- No new packages for Phase 1
- Optional: `react-markdown` if using Markdown
- Optional: `zod` for API validation

---

## 14. Environment Variables

- No new env vars
- Existing: `POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`, Salesforce credentials
