import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LDMA | 50 Years of Gold, Grit & Brotherhood • 1976–2026",
  description:
    "The Lost Dutchman's Mining Association celebrates 50 years of gold prospecting, camaraderie, and the great outdoors. Join us for DirtFest 2026, memberships, and more.",
  openGraph: {
    title: "LDMA | 50 Years of Gold, Grit & Brotherhood",
    description:
      "The Lost Dutchman's Mining Association — 50 years of adventure, discovery, and fellowship.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#1a120b] text-[#e8e0d5] font-sans">
        {children}
      </body>
    </html>
  );
}
