import MetricForm from "@/components/metrics/MetricForm";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <MetricForm id={resolvedParams.id} />;
}
