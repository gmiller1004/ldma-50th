import { redirect } from "next/navigation";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MembersNav } from "../MembersNav";
import { CaretakerPortalContent } from "./CaretakerPortalContent";

export default async function CaretakerPortalPage() {
  const caretaker = await getCaretakerContext();
  if (!caretaker) {
    redirect("/members");
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
        Caretaker Portal
      </h1>
      <p className="text-[#e8e0d5]/70 mb-8">
        You are the caretaker at <strong>{caretaker.campName}</strong>. Look up members to verify
        membership and check them in.
      </p>
      <CaretakerPortalContent campSlug={caretaker.campSlug} campName={caretaker.campName} />
    </>
  );
}
