import { TrainerForm } from "@/components/admin/TrainerForm";

export const dynamic = "force-dynamic";

export default function AdminTrainerNewPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-[#f0d48f] mb-6">New trainer</h1>
      <TrainerForm mode="create" />
    </div>
  );
}
