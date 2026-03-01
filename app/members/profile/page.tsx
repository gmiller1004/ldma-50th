import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { MembersNav } from "../MembersNav";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProfileContent } from "./ProfileContent";

export default async function MembersProfilePage() {
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
          { label: "Members", href: "/members" },
          { label: "Profile" },
        ]}
      />
      <MembersNav />

      <h1 className="font-serif text-3xl font-semibold text-[#f0d48f] mb-8">
        Profile
      </h1>

      <ProfileContent />
    </>
  );
}
