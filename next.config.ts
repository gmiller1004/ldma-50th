import type { NextConfig } from "next";

/** Legacy myldma.com /pages/* redirects */
const LEGACY_REDIRECTS: Array<{ source: string; destination: string }> = [
  // Direct matches
  { source: "/pages/contact", destination: "/contact" },
  { source: "/pages/about", destination: "/about" },
  { source: "/pages/events", destination: "/events" },
  { source: "/pages/membership", destination: "/memberships" },
  { source: "/pages/all-camps", destination: "/campgrounds" },
  // Events variants
  { source: "/pages/events-1", destination: "/events" },
  { source: "/pages/all-events", destination: "/events" },
  // Membership
  { source: "/pages/ldma-membership", destination: "/memberships" },
  // Last 5 → /memberships (per request)
  { source: "/pages/ldmalifetime", destination: "/memberships" },
  { source: "/pages/companiontransfer", destination: "/memberships" },
  { source: "/pages/paydirtaddonbundle", destination: "/memberships" },
  { source: "/pages/minelabaddonbundle", destination: "/memberships" },
  { source: "/pages/gpaaaddonbundle", destination: "/memberships" },
  // Remaining legacy pages (user-specified)
  { source: "/pages/chapter-event-promotion", destination: "/" },
  { source: "/pages/all-camps-preference", destination: "/campgrounds" },
  { source: "/pages/membership-terms-conditions", destination: "/membership-terms" },
  { source: "/pages/careers", destination: "/careers" },
  { source: "/pages/cot", destination: "/events" },
  { source: "/pages/newsletter-signup", destination: "/" },
  { source: "/pages/terms-conditions", destination: "/privacy" },
  { source: "/pages/under-construction", destination: "/maintenance" },
  { source: "/pages/sales-rep-form", destination: "/" },
  { source: "/pages/vip-club-sign-up", destination: "/events" },
];

const nextConfig: NextConfig = {
  async redirects() {
    return LEGACY_REDIRECTS.map(({ source, destination }) => ({
      source,
      destination,
      permanent: true,
    }));
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
