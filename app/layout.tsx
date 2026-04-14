import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { VipUpsellProvider } from "@/context/VipUpsellContext";
import { CartDrawer } from "@/components/CartDrawer";
import { VipUpsellModal } from "@/components/VipUpsellModal";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ChatWidgetGate } from "@/components/ChatWidgetGate";
import { KlaviyoOnsiteScript } from "@/components/KlaviyoOnsiteScript";

// Never use Shopify store URL for site base (canonical, og:url, etc.)
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
const siteUrl =
  typeof rawSiteUrl === "string" && rawSiteUrl.includes("myshopify.com")
    ? "https://ldma-50th.vercel.app"
    : rawSiteUrl;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "LDMA | 50 Years of Gold, Discovery, and Adventure • 1976–2026",
  description:
    "The Lost Dutchman's Mining Association celebrates 50 years of gold prospecting, camaraderie, and the great outdoors. Join us for DirtFest 2026, memberships, and more.",
  openGraph: {
    title: "LDMA | 50 Years of Gold, Discovery, and Adventure",
    description:
      "The Lost Dutchman's Mining Association — 50 years of adventure, discovery, and fellowship.",
    type: "website",
    url: "/",
    siteName: "LDMA",
    images: [
      {
        url: "/images/home/hero-george-italian-bar.jpg",
        width: 1200,
        height: 630,
        alt: "George Buzzard Massie with OG LDMA members at Italian Bar, 1976",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LDMA | 50 Years of Gold, Discovery, and Adventure",
    description:
      "The Lost Dutchman's Mining Association — 50 years of adventure, discovery, and fellowship.",
    images: ["/images/home/hero-george-italian-bar.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/images/LDMA_50_Badge_2-02.png",
    apple: "/images/LDMA_50_Badge_2-02.png",
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
        <KlaviyoOnsiteScript />
        <GoogleAnalytics />
        <CartProvider>
          <VipUpsellProvider>
            {children}
            <CartDrawer />
            <VipUpsellModal />
            <ChatWidgetGate />
          </VipUpsellProvider>
        </CartProvider>
      </body>
    </html>
  );
}
