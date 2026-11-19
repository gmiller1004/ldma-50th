import { listTrainers } from "@/lib/trainers";
import { AdminTrainerList } from "@/components/admin/AdminTrainerList";

export const dynamic = "force-dynamic";

export default async function AdminTrainersPage() {
  const trainers = await listTrainers();

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-[#f0d48f] mb-6">Trainers</h1>
      <AdminTrainerList trainers={trainers} />
    </div>
  );
}
