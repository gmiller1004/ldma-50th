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
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tags (array of strings); add for existing DBs that were created before tags existed
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_updated ON blog_posts(updated_at DESC);

-- Blog post comments (member or anonymous; profanity-hidden not shown)
CREATE TABLE IF NOT EXISTS blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  author_contact_id TEXT,
  author_display_name TEXT,
  body TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_comments_post_id ON blog_comments(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_created ON blog_comments(created_at ASC);
