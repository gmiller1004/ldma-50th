import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { MembersNav } from "./MembersNav";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import Link from "next/link";
import { User, ChevronRight } from "lucide-react";

export default async function MembersDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  if (!token) redirect("/members/login");

  const session = await verifySessionToken(token);
  if (!session) redirect("/members/login");

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Members" },
        ]}
      />
      <MembersNav />

      <h1 className="font-serif text-3xl font-semibold text-[#f0d48f] mb-2">
        Member Dashboard
      </h1>
      <p className="text-[#e8e0d5]/70 mb-8">
        Welcome back. Manage your profile and membership.
      </p>

      <div className="space-y-4">
        <Link
          href="/members/profile"
          className="flex items-center justify-between p-4 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg hover:border-[#d4af37]/40 hover:bg-[#0f0a06]/80 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d4af37]/20 rounded-lg">
              <User className="w-5 h-5 text-[#d4af37]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#e8e0d5]">Profile</h2>
              <p className="text-sm text-[#e8e0d5]/60">
                Update your contact info and address
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#e8e0d5]/40 group-hover:text-[#d4af37] transition-colors" />
        </Link>
      </div>
    </>
  );
}
