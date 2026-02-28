import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default async function MembersLoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  if (token) {
    const session = await verifySessionToken(token);
    if (session) redirect("/members");
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Members", href: "/members" },
          { label: "Sign in" },
        ]}
      />
      <div className="mt-8">
        <h1 className="font-serif text-3xl font-semibold text-[#f0d48f] mb-2">
          Member Sign In
        </h1>
        <p className="text-[#e8e0d5]/70 mb-8">
          Enter your member number to receive a one-time login code at your
          email on file.
        </p>
        <LoginForm />
      </div>
    </>
  );
}
