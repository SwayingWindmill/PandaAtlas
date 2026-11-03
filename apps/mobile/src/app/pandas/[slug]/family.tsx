import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams, useNavigation, usePreventRemove } from "expo-router";
import { HeaderBackButton } from "expo-router/react-navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BackHandler, Linking, Modal, Platform, ScrollView, View } from "react-native";

import { ListCell, ListSection, useSingleColumn } from "@/components/grouped-list";
import { FileText, MapPin, Network, Users } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type Family, type FamilyMember, loadFamily } from "@/features/family/family";
import { FamilyTree } from "@/features/family/family-tree";
import type { GenerationGroup, Kin, Lineage } from "@/features/family/lineage";
import { type LineageSource, loadLineageFor, loadLineageSources } from "@/features/family/lineage-load";
import { hostname } from "@/features/institutions/institutions";
import { openPanda } from "@/features/pandas/panda-row";
import { longDate } from "@/features/pandas/profile";
import { RelationshipContent } from "@/features/relationship/relationship-content";
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

/** The tree and the 家谱 lists of one panda, kept while fresh so stepping back to a family needs no request. */
function familyPageQuery(slug: string) {
  return queryOptions({
    queryKey: ["public", "family-page", slug],
    queryFn: async () => {
      const family = await loadFamily(slug);
      return { family, lineage: await loadLineageFor(family.focus.id) };
    },
    staleTime: 300_000,
    networkMode: "always",
  });
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
            onPress={() => openPanda(row.slug)}
            accessibilityHint="打开它的资料"
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
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { data: loaded, isError, refetch } = useQuery(familyPageQuery(slug));
  const family = loaded?.family;
  const lineage = loaded?.lineage;
  const sourceIds =
    family && lineage
      ? [
          ...new Set(
            lineage.sourceIds.concat(
              family.generation.flatMap((group) => group.members.flatMap((member) => lineage.sourcesOfChild.get(member.id) ?? [])),
            ),
          ),
        ]
      : [];
  // Sources name each link; the page reads without them while they load.
  const { data: sources = [] } = useQuery({
    queryKey: ["public", "lineage-sources", sourceIds],
    queryFn: () => loadLineageSources(sourceIds),
    enabled: sourceIds.length > 0,
    staleTime: 300_000,
    networkMode: "always",
  });

  // Tapping a portrait re-centres the tree here instead of pushing a new screen, so the tree can move
  // from one family to the next. `history` is the families walked through; back steps through them first.
  const [history, setHistory] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [switchFailed, setSwitchFailed] = useState(false);
  const [transition, setTransition] = useState<{ from: Family; to: string } | null>(null);
  const [relating, setRelating] = useState(false);
  // Only the latest switch may land; leaving the screen drops the one in flight.
  const request = useRef(0);

  useFocusEffect(
    useCallback(
      () => () => {
        request.current += 1;
        setPending(null);
      },
      [],
    ),
  );

  // The nearest relatives are the likely next taps; their families load two at a time while the tree is read.
  useEffect(() => {
    if (!family) return;
    let cancelled = false;
    const next = [
      family.father,
      family.mother,
      ...family.generation.flatMap((group) => group.members).filter((member) => member.id !== family.focus.id),
      ...family.children,
    ]
      .filter((member): member is FamilyMember => member !== null)
      .slice(0, 4);
    void (async () => {
      for (let index = 0; index < next.length && !cancelled; index += 2) {
        await Promise.all(next.slice(index, index + 2).map((member) => queryClient.prefetchQuery(familyPageQuery(member.slug))));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [family, queryClient]);

  useEffect(() => {
    if (!transition || transition.to !== slug) return;
    const timer = setTimeout(() => setTransition(null), 300);
    return () => clearTimeout(timer);
  }, [slug, transition]);

  const switchTo = useCallback(
    async (to: string, nextHistory: string[]) => {
      const current = ++request.current;
      setPending(to);
      setSwitchFailed(false);
      try {
        await queryClient.ensureQueryData(familyPageQuery(to));
        if (current !== request.current) return;
        if (family) setTransition({ from: family, to });
        setHistory(nextHistory);
        router.setParams({ slug: to });
      } catch {
        if (current === request.current) setSwitchFailed(true);
      } finally {
        if (current === request.current) setPending(null);
      }
    },
    [family, queryClient],
  );

  const select = useCallback(
    (to: string) => {
      if (pending || to === slug) return;
      void switchTo(to, [...history, slug]);
    },
    [history, pending, slug, switchTo],
  );

  const goBack = useCallback(() => {
    const previous = history.at(-1);
    if (previous) void switchTo(previous, history.slice(0, -1));
  }, [history, switchTo]);

  // Back (the bar, the edge swipe, Android's back key) steps through the families walked through first.
  usePreventRemove(history.length > 0, goBack);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || history.length === 0) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [goBack, history.length]),
  );
  // A 家谱 opened from a link has no screen beneath it, so the bar has no back button of its own.
  useLayoutEffect(() => {
    const needsBack = history.length > 0 && !navigation.canGoBack();
    navigation.setOptions({
      headerLeft: needsBack
        ? (props: { tintColor?: string }) => <HeaderBackButton {...props} label="返回" accessibilityLabel="返回" onPress={goBack} />
        : undefined,
    });
  }, [goBack, history.length, navigation]);

  if (!family || !lineage) {
    return (
      <Page label="家谱" title="家族">
        {isError ? (
          <LoadFailed message="家谱暂时打不开。" onRetry={() => void refetch()} />
        ) : (
          <Skeleton className="h-96 w-full rounded-tile" accessibilityLabel="正在加载家谱" />
        )}
      </Page>
    );
  }

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
      <View className="gap-stack-tight">
        <FamilyTree
          family={family}
          previousFamily={transition?.to === slug ? transition.from : undefined}
          onSelect={(member) => select(member.slug)}
          pending={pending}
        />
        {switchFailed ? (
          <Text variant="footnote" accessibilityRole="alert" className="text-muted-foreground">
            这个家谱暂时打不开，再点一次头像试试。
          </Text>
        ) : null}
        <Button variant="secondary" className="self-start" onPress={() => setRelating(true)}>
          <Text>查关系</Text>
        </Button>
      </View>
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

      {/* 查关系 from the family: the system sheet, starting on the panda whose tree is open. */}
      <Modal visible={relating} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRelating(false)}>
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between px-4 pt-4">
            <Text variant="title" role="heading">
              查关系
            </Text>
            <Button variant="plain" onPress={() => setRelating(false)}>
              <Text>完成</Text>
            </Button>
          </View>
          <ScrollView contentContainerClassName="gap-6 px-4 pt-4 pb-12" keyboardShouldPersistTaps="handled">
            {relating ? (
              <RelationshipContent
                from={slug}
                onOpen={(pandaSlug) => {
                  setRelating(false);
                  openPanda(pandaSlug);
                }}
                onFamily={(panda) => {
                  setRelating(false);
                  select(panda.slug);
                }}
              />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </Page>
  );
}
