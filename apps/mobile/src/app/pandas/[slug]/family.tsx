import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, View } from "react-native";

import { ListCell, ListSection, useSingleColumn } from "@/components/grouped-list";
import { FileText, MapPin, Network, Users } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { StatTile } from "@/components/stat-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { type Family, loadFamily } from "@/features/family/family";
import { FamilyTree } from "@/features/family/family-tree";
import type { GenerationGroup, Kin, Lineage } from "@/features/family/lineage";
import { type LineageSource, loadLineageFor, loadLineageSources } from "@/features/family/lineage-load";
import { hostname } from "@/features/institutions/institutions";
import { longDate } from "@/features/pandas/profile";
import { cn } from "@/lib/utils";

/** One relative as the linear 家谱 lists it; the list is the tree's reading order for VoiceOver and at large text. */
interface Row {
  id: string;
  slug: string;
  name: string;
  relation: string;
  birthDate: string | null;
  deceased: boolean;
  sourceIds: string[];
}

function rowDetail(row: Row, hosts: ReadonlyMap<string, string>): string {
  const sources = [...new Set(row.sourceIds.flatMap((id) => hosts.get(id) ?? []))];
  // When every link on the page shares one publisher the 出处 section below already says so; repeating it per row is noise.
  const perRow = new Set(hosts.values()).size > 1;
  return [
    row.relation,
    row.birthDate ? `${row.birthDate.slice(0, 4)} 年出生` : "",
    // DECEASED_POLICY: a panda that has died is marked plainly, never celebrated or pushed.
    row.deceased ? "已离世" : "",
    perRow && sources.length > 0 ? `出处 ${sources.join("、")}` : "",
  ]
    .filter(Boolean)
    .join("　");
}

function openFamilyOf(slug: string) {
  router.push({ pathname: "/pandas/[slug]/family", params: { slug } });
}

function GenerationSection({ title, rows, missing, hosts }: { title: string; rows: Row[]; missing: number; hosts: ReadonlyMap<string, string> }) {
  const footer = rows.length > 0 && missing > 0 ? `还有 ${missing} 位暂无公开资料。` : undefined;
  return (
    <ListSection title={title} footer={footer}>
      {rows.length === 0 ? (
        <ListCell label="暂无公开资料" last />
      ) : (
        rows.map((row, index) => (
          <ListCell
            key={row.id}
            label={row.name}
            detail={rowDetail(row, hosts)}
            leading={<PandaThumb pandaId={row.id} name={row.name} size={40} shape="round" />}
            onPress={() => openFamilyOf(row.slug)}
            accessibilityHint="打开它的家谱"
            last={index === rows.length - 1}
          />
        ))
      )}
    </ListSection>
  );
}

const asRow = (kin: Kin): Row => kin;

/** The family's reach in three numbers, as Fitness sums a week: generations up, descendants, places. */
function Summary({ lineage }: { lineage: Lineage }) {
  const single = useSingleColumn();
  const places = lineage.descendantPlaces.length;
  return (
    <View className={cn("gap-row", single ? "flex-col" : "flex-row")}>
      <StatTile icon={Network} label="上溯" value={lineage.ancestorDepth > 0 ? `${lineage.ancestorDepth} 代` : "—"} />
      <StatTile icon={Users} label="后代" value={`${lineage.descendantCount} 只`} />
      <StatTile icon={MapPin} label="分布" value={places > 0 ? `${places} 处` : "—"} />
    </View>
  );
}

function Sources({ sources }: { sources: LineageSource[] }) {
  if (sources.length === 0) return null;
  return (
    <ListSection title="出处" footer="只画有公开出处的亲缘关系；没有出处的，不画也不猜。">
      {sources.map((source, index) => (
        <ListCell
          key={source.sourceId}
          icon={FileText}
          label={source.title}
          detail={`${source.publisher}　核实于 ${longDate(source.lastVerifiedOn)}`}
          role="link"
          accessibilityHint="在浏览器中打开"
          lines={2}
          onPress={() => void Linking.openURL(source.url)}
          last={index === sources.length - 1}
        />
      ))}
    </ListSection>
  );
}

export default function FamilyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [loaded, setLoaded] = useState<{ family: Family; lineage: Lineage } | null>(null);
  const [sources, setSources] = useState<LineageSource[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadFamily(slug)
      .then(async (family) => {
        const lineage = await loadLineageFor(family.focus.id);
        setLoaded({ family, lineage });
        // Sources name each link; the page reads without them while they load.
        const lineageSources = lineage.sourceIds.concat(
          family.generation.flatMap((group) => group.members.flatMap((member) => lineage.sourcesOfChild.get(member.id) ?? [])),
        );
        setSources(await loadLineageSources([...new Set(lineageSources)]));
      })
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  if (!loaded) {
    return (
      <Page label="家谱" title="家族">
        {failed ? (
          <LoadFailed message="家谱暂时打不开。" onRetry={retry} />
        ) : (
          <Skeleton className="h-96 w-full rounded-tile" accessibilityLabel="正在加载家谱" />
        )}
      </Page>
    );
  }

  const { family, lineage } = loaded;
  const hosts = new Map(sources.map((source) => [source.sourceId, hostname(source.url)]));
  const siblings: Row[] = family.generation
    .flatMap((group) => group.members)
    .filter((member) => member.id !== family.focus.id)
    .map((member) => ({ ...member, sourceIds: lineage.sourcesOfChild.get(member.id) ?? [] }));
  const ancestors = lineage.groups.filter((group) => group.generation < 0);
  const descendants = lineage.groups.filter((group) => group.generation > 0);
  const section = (group: GenerationGroup) => (
    <GenerationSection key={group.generation} title={group.title} rows={group.members.map(asRow)} missing={group.missing} hosts={hosts} />
  );
  const known = lineage.ancestorDepth > 0 || lineage.descendantCount > 0 || siblings.length > 0;

  return (
    <Page label="家谱" title={`${family.focus.name}的家族`}>
      <FamilyTree family={family} />
      {known ? <Summary lineage={lineage} /> : null}
      {lineage.descendantPlaces.length > 0 ? (
        <ListSection
          title="后代现在住在"
          footer={lineage.descendantsUnplaced > 0 ? `还有 ${lineage.descendantsUnplaced} 只的具体住处暂无公开资料。` : undefined}
        >
          {lineage.descendantPlaces.map((item, index) => (
            <ListCell key={item.place} icon={MapPin} label={item.place} meta={`${item.count} 只`} last={index === lineage.descendantPlaces.length - 1} />
          ))}
        </ListSection>
      ) : null}
      {/* Oldest generation first, as a family book reads: the same people as the tree, one per line. */}
      {ancestors.map(section)}
      {siblings.length > 0 ? <GenerationSection title="同辈" rows={siblings} missing={0} hosts={hosts} /> : null}
      {descendants.map(section)}
      <Sources sources={sources} />
    </Page>
  );
}
