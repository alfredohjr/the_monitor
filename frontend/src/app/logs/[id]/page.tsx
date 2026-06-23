import LogForm from "@/components/logs/LogForm";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <LogForm id={resolvedParams.id} />;
}
