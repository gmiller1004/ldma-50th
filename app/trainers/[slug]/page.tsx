import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedTrainers, getTrainerBySlug } from "@/lib/trainers";
import { TrainerProfileView } from "@/components/trainers/TrainerProfileView";
import { nonEmpty } from "@/components/trainers/format";

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const trainer = await getTrainerBySlug(slug);
  if (!trainer) return { title: "Trainer Not Found | LDMA" };

  const title = nonEmpty(trainer.title);
  const pageTitle = title ? `${trainer.name} — ${title}` : trainer.name;
  const description = nonEmpty(trainer.summary) ?? `Meet ${trainer.name}, an LDMA Certified Trainer.`;
  const photo = nonEmpty(trainer.photoUrl);

  return {
    title: `${pageTitle} | LDMA Certified Trainers`,
    description,
    alternates: { canonical: `/trainers/${trainer.slug}` },
    openGraph: {
      title: pageTitle,
      description,
      url: `/trainers/${trainer.slug}`,
      type: "profile",
      images: photo ? [{ url: photo, alt: `Portrait of ${trainer.name}` }] : undefined,
    },
  };
}

export default async function TrainerPage({ params }: Props) {
  const { slug } = await params;
  const trainer = await getTrainerBySlug(slug);
  if (!trainer) notFound();

  const trainers = await getPublishedTrainers();
  const index = trainers.findIndex((item) => item.slug === trainer.slug);
  const previous = index > 0 ? trainers[index - 1] : null;
  const next = index >= 0 && index < trainers.length - 1 ? trainers[index + 1] : null;

  return (
    <TrainerProfileView
      trainer={trainer}
      previous={previous ? { slug: previous.slug, name: previous.name } : null}
      next={next ? { slug: next.slug, name: next.name } : null}
    />
  );
}
