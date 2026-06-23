import GoalForm from "@/components/goals/GoalForm";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <GoalForm id={resolvedParams.id} />;
}
