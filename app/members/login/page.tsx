import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { User, MessageCircle, Gift, Phone } from "lucide-react";

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
      <div className="mt-8 max-w-xl">
        <h1 className="font-serif text-3xl font-semibold text-[#f0d48f] mb-2">
          Member Sign In
        </h1>
        <p className="text-[#e8e0d5]/70 mb-8">
          Enter your member number below. We&apos;ll send a one-time login code
          to the email we have on file.
        </p>

        <LoginForm />

        <section className="mt-10 pt-8 border-t border-[#d4af37]/20">
          <h2 className="font-semibold text-[#f0d48f] mb-4">
            When you&apos;re signed in, you can:
          </h2>
          <ul className="space-y-3 text-[#e8e0d5]/85 text-sm">
            <li className="flex items-start gap-3">
              <span className="shrink-0 mt-0.5 p-1.5 bg-[#d4af37]/15 rounded-lg">
                <User className="w-4 h-4 text-[#d4af37]" />
              </span>
              <span>
                <strong className="text-[#e8e0d5]">View your personalized offer</strong> — See member-only pricing and your profile in one place.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 mt-0.5 p-1.5 bg-[#d4af37]/15 rounded-lg">
                <MessageCircle className="w-4 h-4 text-[#d4af37]" />
              </span>
              <span>
                <strong className="text-[#e8e0d5]">Camp directory & community</strong> — Browse camps, share trip reports, and join discussions with other members.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 mt-0.5 p-1.5 bg-[#d4af37]/15 rounded-lg">
                <Gift className="w-4 h-4 text-[#d4af37]" />
              </span>
              <span>
                <strong className="text-[#e8e0d5]">Exclusive member offers</strong> — Access limited-time deals and member-only products.
              </span>
            </li>
          </ul>
        </section>

        <section className="mt-6 p-4 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg">
          <div className="flex gap-3">
            <span className="shrink-0 p-2 bg-[#d4af37]/15 rounded-lg h-fit">
              <Phone className="w-5 h-5 text-[#d4af37]" />
            </span>
            <div>
              <p className="font-semibold text-[#e8e0d5] mb-1">
                Don&apos;t have your member number?
              </p>
              <p className="text-sm text-[#e8e0d5]/80">
                Call Member Relations at{" "}
                <a
                  href="tel:+18884653717"
                  className="text-[#d4af37] hover:text-[#f0d48f] font-medium underline underline-offset-2"
                >
                  (888) 465-3717
                </a>
                . We can look up your number and help you sign in.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
