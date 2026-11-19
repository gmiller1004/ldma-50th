import { notFound } from "next/navigation";
import { getTrainerById } from "@/lib/trainers";
import { TrainerForm } from "@/components/admin/TrainerForm";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminTrainerEditPage({ params }: Props) {
  const { id } = await params;
  const trainer = await getTrainerById(id);
  if (!trainer) notFound();

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-[#f0d48f] mb-6">Edit: {trainer.name}</h1>
      <TrainerForm trainer={trainer} mode="edit" />
    </div>
  );
}
