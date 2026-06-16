import { redirect } from "next/navigation";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MembersNav } from "../MembersNav";
import { CaretakerPortalContent } from "./CaretakerPortalContent";
import { CaretakerAdminDashboard } from "./CaretakerAdminDashboard";
import { CaretakerThemeShell } from "./CaretakerThemeShell";

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
            { label: "Director dashboard" },
          ]}
        />
        <MembersNav />
        <CaretakerThemeShell>
          <h1 className="font-serif text-3xl font-semibold ct-heading mb-2">
            Director dashboard
          </h1>
          <p className="ct-subtext mb-8 max-w-3xl">
            Cross-camp read-only view: pick a Stripe date range, scan KPIs and the grid, then expand a camp for
            reservations, revenue detail, and caretaker activity.
          </p>
          <CaretakerAdminDashboard />
        </CaretakerThemeShell>
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
      <CaretakerThemeShell>
        <h1 className="font-serif text-3xl font-semibold ct-heading mb-2">
          Caretaker Portal: {access.campName}
        </h1>
        <p className="ct-subtext mb-8">
          Look up members to verify membership and check them in.
        </p>
        <CaretakerPortalContent campSlug={access.campSlug} campName={access.campName} />
      </CaretakerThemeShell>
    </>
  );
}
