import type { Metadata } from "next";
import { getPublishedTrainers } from "@/lib/trainers";
import { TrainersDirectory } from "@/components/trainers/TrainersDirectory";

export const revalidate = 300;

const title = "LDMA Certified Trainers";
const description =
  "Meet the LDMA Certified Trainers who lead hands-on prospecting classes at LDMA events, and see which camps they'll be teaching at.";

export const metadata: Metadata = {
  title: `${title} | Lost Dutchman's Mining Association`,
  description,
  alternates: { canonical: "/trainers" },
  openGraph: {
    title,
    description,
    url: "/trainers",
    type: "website",
  },
};

export default async function TrainersPage() {
  const trainers = await getPublishedTrainers();
  return <TrainersDirectory trainers={trainers} />;
}
