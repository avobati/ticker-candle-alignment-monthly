import { Dashboard } from "@/components/dashboard";
import { getAlignmentRows } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export default async function Home() {
  const data = await getAlignmentRows();

  return <Dashboard generatedAt={data.generatedAt} initialData={data.rows} />;
}
