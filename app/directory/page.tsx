import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DirectoryPageContent } from "./DirectoryPageContent";
import { directoryCamps } from "@/lib/directory-camps";

export const metadata: Metadata = {
  title: "Camp Directory & Community | LDMA 50th Anniversary",
  description:
    "Explore LDMA camps and join the community. Trip reports, discussions, and member conversations about gold prospecting across our campgrounds.",
};

export default function DirectoryPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <DirectoryPageContent camps={directoryCamps} />
      </main>
      <Footer />
    </>
  );
}
