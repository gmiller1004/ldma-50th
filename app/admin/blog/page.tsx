import Link from "next/link";
import { getPosts } from "@/lib/blog";
import { AdminBlogList } from "@/components/admin/AdminBlogList";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const posts = await getPosts({
    publishedOnly: false,
    limit: 200,
  });

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-[#f0d48f] mb-6">
        Blog posts
      </h1>
      <AdminBlogList posts={posts} />
    </div>
  );
}
