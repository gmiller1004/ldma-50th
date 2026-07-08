import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getEventProductByHandle } from "@/lib/shopify";
import { verifySessionToken } from "@/lib/session";
import { parseEventDescriptionHtml } from "@/lib/event-description";
import { getCardTitle } from "@/lib/event-display";
import { EventProductPageContent } from "../EventProductPageContent";

export const revalidate = 300;
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const event = await getEventProductByHandle(handle);
  if (!event) return { title: "Event Not Found | LDMA" };

  const parsed = parseEventDescriptionHtml(event.descriptionHtml);
  const description =
    parsed.plainTextSummary ||
    `Register for ${getCardTitle(event.title)} — LDMA gold prospecting event.`;

  return {
    title: `${getCardTitle(event.title)} | LDMA Events`,
    description,
    openGraph: {
      title: getCardTitle(event.title),
      description,
      images: event.featuredImage?.url ? [{ url: event.featuredImage.url }] : undefined,
    },
  };
}

export default async function EventProductPage({ params }: Props) {
  const { handle } = await params;
  const event = await getEventProductByHandle(handle);
  if (!event) notFound();

  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20">
        <EventProductPageContent event={event} isMemberLoggedIn={!!session} />
      </main>
      <Footer />
    </>
  );
}
