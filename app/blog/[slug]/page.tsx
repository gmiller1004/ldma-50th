import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug, getSimilarPosts } from "@/lib/blog";
import { getCommentsForPost } from "@/lib/blog-comments";
import { BlogPostContent } from "@/components/BlogPostContent";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug, { publishedOnly: true });
  if (!post) return { title: "Post Not Found" };

  const description = post.excerpt ?? post.title;
  const image = post.featuredImageUrl ?? undefined;

  return {
    title: `${post.title} | LDMA Blog`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      images: image ? [{ url: image, alt: post.title }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug, { publishedOnly: true });
  if (!post) notFound();

  const [similarPosts, initialComments] = await Promise.all([
    getSimilarPosts(post.id, post.categoryId, 4),
    getCommentsForPost(post.id),
  ]);

  return (
    <div className="py-8">
      <BlogPostContent
        post={post}
        similarPosts={similarPosts}
        initialComments={initialComments}
        baseUrl={baseUrl}
      />
    </div>
  );
}
