import { notFound } from "next/navigation";
import { getPostById, getCategories } from "@/lib/blog";
import { BlogPostForm } from "@/components/admin/BlogPostForm";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminBlogEditPage({ params }: Props) {
  const { id } = await params;
  const [post, categories] = await Promise.all([
    getPostById(id),
    getCategories(),
  ]);

  if (!post) notFound();

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-[#f0d48f] mb-6">
        Edit: {post.title}
      </h1>
      <BlogPostForm post={post} categories={categories} mode="edit" />
    </div>
  );
}
