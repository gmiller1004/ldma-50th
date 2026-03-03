import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminMember } from "@/lib/blog-admin";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ArrowLeft, PenSquare, List } from "lucide-react";

export default async function AdminBlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminMember();
  if (!admin) {
    redirect("/members/login?redirect=/admin/blog");
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/admin/blog"
              className="inline-flex items-center gap-2 text-[#e8e0d5]/80 hover:text-[#d4af37] text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Blog Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/admin/blog"
                className="inline-flex items-center gap-1.5 text-[#e8e0d5]/80 hover:text-[#d4af37]"
              >
                <List className="w-4 h-4" />
                All posts
              </Link>
              <Link
                href="/admin/blog/new"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f]"
              >
                <PenSquare className="w-4 h-4" />
                New post
              </Link>
            </nav>
          </div>
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
