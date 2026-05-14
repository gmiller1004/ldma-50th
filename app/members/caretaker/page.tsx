import { redirect } from "next/navigation";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MembersNav } from "../MembersNav";
import { CaretakerPortalContent } from "./CaretakerPortalContent";
import { CaretakerAdminDashboard } from "./CaretakerAdminDashboard";

export default async function CaretakerPortalPage() {
  const access = await getCaretakerAccess();
  if (!access) {
    redirect("/members");
  }

  if (access.mode === "admin") {
    return (
      <>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Members", href: "/members" },
            { label: "Caretaker Admin" },
          ]}
        />
        <MembersNav />
        <h1 className="font-serif text-3xl font-semibold text-[#f0d48f] mb-2">
          Caretaker Admin
        </h1>
        <p className="text-[#e8e0d5]/70 mb-8">
          Overview of all camps: roster from Salesforce and activity from this site.
        </p>
        <CaretakerAdminDashboard />
      </>
    );
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Members", href: "/members" },
          { label: "Caretaker Portal" },
        ]}
      />
      <MembersNav />
      <h1 className="font-serif text-3xl font-semibold text-[#f0d48f] mb-2">
        Caretaker Portal: {access.campName}
      </h1>
      <p className="text-[#e8e0d5]/70 mb-8">
        Look up members to verify membership and check them in.
      </p>
      <CaretakerPortalContent campSlug={access.campSlug} campName={access.campName} />
    </>
  );
}
