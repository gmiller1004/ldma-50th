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
        {/* Narrow on small screens for readability; from md up use nearly full width for data-heavy pages (e.g. caretaker admin). */}
        <div className="mx-auto w-full max-w-2xl md:max-w-[min(88rem,calc(100vw-4rem))] px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
