import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams, useNavigation, usePreventRemove } from "expo-router";
import { HeaderBackButton } from "expo-router/react-navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Modal, Pressable, ScrollView, View } from "react-native";

import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { ChevronRight, MapPin } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type Family, type FamilyMember, loadFamily } from "@/features/family/family";
import { FamilyTree } from "@/features/family/family-tree";
import type { GenerationGroup, Kin, Lineage } from "@/features/family/lineage";
import { loadLineageFor } from "@/features/family/lineage-load";
import { openPanda } from "@/features/pandas/panda-row";
import { RelationshipContent } from "@/features/relationship/relationship-content";
import { useBackToClose } from "@/lib/use-back-to-close";
import { cn } from "@/lib/utils";

/** One relative as the linear 家谱 lists it; the list is the tree's reading order for VoiceOver and at large text. */
interface Row {
  id: string;
  slug: string;
  name: string;
  relation: string;
  birthDate: string | null;
  deceased: boolean;
}

function rowDetail(row: Row): string {
  return [
    row.relation,
    row.birthDate ? `${row.birthDate.slice(0, 4)} 年出生` : "",
    // DECEASED_POLICY: a panda that has died is marked plainly, never celebrated or pushed.
    row.deceased ? "已离世" : "",
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

function GenerationSection({ title, rows, missing }: { title: string; rows: Row[]; missing: number }) {
  const stacked = useStacked();
  const footer = rows.length > 0 && missing > 0 ? `还有 ${missing} 位暂无公开资料。` : undefined;
  return (
    <View className="gap-stack-tight">
      <Text variant="title" role="heading">
        {title}
      </Text>
      <View>
        {rows.length === 0 ? (
          <Text variant="subheadline" className="py-row text-muted-foreground">
            暂无公开资料
          </Text>
        ) : (
          rows.map((row, index) => {
            const last = index === rows.length - 1;
            return (
              <Pressable
                key={row.id}
                role="button"
                accessibilityLabel={row.name}
                accessibilityHint="打开它的资料"
                onPress={() => openPanda(row.slug)}
                className={cn(
                  "min-h-11 flex-row items-center gap-row py-row active:opacity-60",
                  !last && "border-b-hairline border-border",
                )}
              >
                <PandaThumb pandaId={row.id} name={row.name} size={40} shape="round" />
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text variant="body" className="min-w-0 shrink font-semibold" numberOfLines={stacked ? undefined : 1}>
                    {row.name}
                  </Text>
                  <Text
                    variant="footnote"
                    className="min-w-0 shrink text-muted-foreground"
                    numberOfLines={stacked ? undefined : 2}
                  >
                    {rowDetail(row)}
                  </Text>
                </View>
                <Chevron />
              </Pressable>
            );
          })
        )}
      </View>
      {footer ? (
        <Text variant="footnote" className="text-muted-foreground">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

const asRow = (kin: Kin): Row => kin;

/** Borderless 3-column summary strip (`上溯 | 后代 | 亲缘查询`), stacking cleanly at large text. */
function SummaryStrip({ lineage, onRelate }: { lineage: Lineage; onRelate: () => void }) {
  const stacked = useStacked();
  const depth = lineage.ancestorDepth > 0 ? `${lineage.ancestorDepth} 代` : "—";
  const descendants = `${lineage.descendantCount} 只`;
  return (
    <View
      className={cn(
        "border-t-hairline border-b-hairline border-border py-0.5",
        stacked ? "gap-1 py-1.5" : "flex-row items-stretch",
      )}
    >
      <View className={stacked ? undefined : "min-w-0 flex-1 flex-row items-stretch"}>
        <View
          accessible
          accessibilityLabel={`上溯 ${depth}`}
          className={
            stacked
              ? "flex-row items-center justify-between gap-3 py-1.5"
              : "min-w-0 flex-1 items-center justify-center px-1.5 py-2"
          }
        >
          <Text variant="footnote" className={cn("font-medium text-muted-foreground", stacked && "shrink-0")} numberOfLines={1}>
            上溯
          </Text>
          <Text
            variant="headline"
            className={cn(
              "min-w-0 shrink font-bold tabular-nums",
              lineage.ancestorDepth <= 0 && "text-tertiary-foreground",
              !stacked && "mt-0.5",
            )}
            numberOfLines={1}
          >
            {depth}
          </Text>
        </View>
      </View>
      <View className={stacked ? undefined : "min-w-0 flex-1 flex-row items-stretch"}>
        {!stacked ? <View className="my-2 w-hairline bg-border" /> : null}
        <View
          accessible
          accessibilityLabel={`后代 ${descendants}`}
          className={
            stacked
              ? "flex-row items-center justify-between gap-3 py-1.5"
              : "min-w-0 flex-1 items-center justify-center px-1.5 py-2"
          }
        >
          <Text variant="footnote" className={cn("font-medium text-muted-foreground", stacked && "shrink-0")} numberOfLines={1}>
            后代
          </Text>
          <Text variant="headline" className={cn("min-w-0 shrink font-bold tabular-nums", !stacked && "mt-0.5")} numberOfLines={1}>
            {descendants}
          </Text>
        </View>
      </View>
      <View className={stacked ? undefined : "min-w-0 flex-1 flex-row items-stretch"}>
        {!stacked ? <View className="my-2 w-hairline bg-border" /> : null}
        <Pressable
          role="button"
          accessibilityLabel="查关系"
          onPress={onRelate}
          className={cn(
            "min-h-11 active:opacity-60",
            stacked
              ? "flex-row items-center justify-between gap-3 py-1.5"
              : "min-w-0 flex-1 items-center justify-center px-1.5 py-2",
          )}
        >
          <Text variant="footnote" className={cn("font-medium text-muted-foreground", stacked && "shrink-0")} numberOfLines={1}>
            亲缘查询
          </Text>
          <View className={cn("flex-row items-center gap-0.5", !stacked && "mt-0.5")}>
            <Text variant="headline" className="font-bold text-primary" numberOfLines={1}>
              查关系
            </Text>
            <Icon icon={ChevronRight} size="footnote" tone="tint" strokeWidth={2.2} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function DescendantPlaces({ places, unplaced }: { places: Lineage["descendantPlaces"]; unplaced: number }) {
  const stacked = useStacked();
  if (places.length === 0) return null;
  return (
    <View className="gap-stack-tight">
      <Text variant="title" role="heading">
        后代现在住在
      </Text>
      <View>
        {places.map((item, index) => {
          const last = index === places.length - 1;
          return (
            <View
              key={item.place}
              accessible
              accessibilityLabel={`${item.place}，${item.count} 只`}
              className={cn(
                "py-row",
                stacked ? "gap-hair-gap" : "min-h-11 flex-row items-center justify-between gap-row",
                !last && "border-b-hairline border-border",
              )}
            >
              <View className={cn("flex-row items-center gap-row", !stacked && "min-w-0 flex-1")}>
                <Icon icon={MapPin} size="subhead" tone="secondary" />
                <Text variant="body" className="min-w-0 shrink" numberOfLines={stacked ? undefined : 1}>
                  {item.place}
                </Text>
              </View>
              <Text
                variant="subheadline"
                className={cn("text-muted-foreground tabular-nums", stacked ? "pl-7" : "shrink-0")}
              >
                {`${item.count} 只`}
              </Text>
            </View>
          );
        })}
      </View>
      {unplaced > 0 ? (
        <Text variant="footnote" className="text-muted-foreground">
          {`还有 ${unplaced} 只的具体住处暂无公开资料。`}
        </Text>
      ) : null}
    </View>
  );
}

export default function FamilyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { data: loaded, isError, refetch } = useQuery(familyPageQuery(slug));
  const family = loaded?.family;
  const lineage = loaded?.lineage;

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
        const next = await queryClient.ensureQueryData(familyPageQuery(to));
        if (current !== request.current) return;
        if (family) setTransition({ from: family, to });
        setHistory(nextHistory);
        router.setParams({ slug: to });
        // The tree changes in place, with no new screen for VoiceOver to land on.
        AccessibilityInfo.announceForAccessibility(`已切换到${next.family.focus.name}的家族`);
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
  useBackToClose(history.length > 0, goBack);
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

  const siblings: Row[] = family.generation
    .flatMap((group) => group.members)
    .filter((member) => member.id !== family.focus.id);
  const ancestors = lineage.groups.filter((group) => group.generation < 0);
  const descendants = lineage.groups.filter((group) => group.generation > 0);
  const section = (group: GenerationGroup) => (
    <GenerationSection key={group.generation} title={group.title} rows={group.members.map(asRow)} missing={group.missing} />
  );
  const known = lineage.ancestorDepth > 0 || lineage.descendantCount > 0 || siblings.length > 0;

  return (
    <Page label="家谱" title={`${family.focus.name}的家族`}>
      <View className="gap-stack-tight">
        <FamilyTree
          family={family}
          previousFamily={transition?.to === slug ? transition.from : undefined}
          onSelect={(member) => select(member.slug)}
          onOpen={(member) => openPanda(member.slug)}
          pending={pending}
        />
        {switchFailed ? (
          <Text variant="footnote" accessibilityRole="alert" className="text-muted-foreground">
            这个家谱暂时打不开，再点一次头像试试。
          </Text>
        ) : null}
        {!known ? (
          <Button variant="secondary" className="self-start" onPress={() => setRelating(true)}>
            <Text>查关系</Text>
          </Button>
        ) : null}
      </View>
      {known ? <SummaryStrip lineage={lineage} onRelate={() => setRelating(true)} /> : null}
      <DescendantPlaces places={lineage.descendantPlaces} unplaced={lineage.descendantsUnplaced} />
      {/* Oldest generation first, as a family book reads: the same people as the tree, one per line. */}
      {ancestors.map(section)}
      {siblings.length > 0 ? <GenerationSection title="同辈" rows={siblings} missing={0} /> : null}
      {descendants.map(section)}

      <Text variant="footnote" className="pt-stack-tight text-center text-muted-foreground">
        仅收录有公开档案依据的亲缘关系，不推断未记载亲属
      </Text>

      {/* 查关系 from the family: the system sheet, starting on the panda whose tree is open. */}
      <Modal visible={relating} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRelating(false)}>
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between px-gutter pt-4">
            <Text variant="title" role="heading">
              查关系
            </Text>
            <Button variant="plain" onPress={() => setRelating(false)}>
              <Text>完成</Text>
            </Button>
          </View>
          <ScrollView contentContainerClassName="gap-6 px-gutter pt-4 pb-12" keyboardShouldPersistTaps="handled">
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
