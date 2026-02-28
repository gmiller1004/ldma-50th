import { Navbar } from "@/components/Navbar";

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#1a120b] text-[#e8e0d5]">
      <Navbar />
      <main className="pt-24 md:pt-28 pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
