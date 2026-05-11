import { LineageExplorer } from "@/components/lineage/lineage-explorer";
import { SiteHeader } from "@/components/site/site-header";
import { getPandaLineage, resolvePandaReference } from "@/lib/api-client";

interface LineagePageProps {
  searchParams?: Promise<{ focus?: string }>;
}

export default async function LineagePage({ searchParams }: LineagePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const focus = resolvedSearchParams?.focus?.trim() || undefined;
  const reference = focus ? await resolvePandaReference(focus) : null;

  const initialLineage = await getPandaLineage(focus, {
    ancestorDepth: 8,
    descendantDepth: 8,
    reference
  });

  return (
    <main className="lineage-page pb-0 pt-0" data-testid="lineage-page">
      <SiteHeader statusLabel="谱系图谱" statusValue="关系探索" />
      <LineageExplorer initialLineage={initialLineage} />
    </main>
  );
}
