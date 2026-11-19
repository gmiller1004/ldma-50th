import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function TrainersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#1a120b] pt-16 md:pt-20">{children}</main>
      <Footer />
    </>
  );
}
