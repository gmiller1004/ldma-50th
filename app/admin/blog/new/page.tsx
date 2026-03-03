import { getCategories } from "@/lib/blog";
import { BlogPostForm } from "@/components/admin/BlogPostForm";

export const dynamic = "force-dynamic";

export default async function AdminBlogNewPage() {
  const categories = await getCategories();

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-[#f0d48f] mb-6">
        New post
      </h1>
      <BlogPostForm categories={categories} mode="create" />
    </div>
  );
}
