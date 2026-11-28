import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNetworkState } from "expo-network";
import { router, useNavigation } from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";

import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { MapIcon } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import {
  guestSeenEntriesQueryOptions,
  guestVisitsQueryOptions,
  removeGuestVisit,
} from "@/features/engagement/guest-store";
import { localToday, seenEntriesQueryOptions } from "@/features/engagement/seen";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { openPanda } from "@/features/pandas/panda-row";
import {
  type PandaListItem,
  pandaIndexQueryOptions,
  placeName,
  placesQueryOptions,
} from "@/features/pandas/pandas";
import { longDate } from "@/features/pandas/profile";
import { useAccount } from "@/features/session/account";
import { useSession } from "@/features/session/session";
import { groupVisitsByYear, matchSeenPandasForVisit } from "@/features/visits/visit-diary";
import {
  flushOfflineCheckins,
  isQueuedVisitId,
  mergeSeenWithQueue,
  mergeVisitsWithQueue,
  queueKeyFromVisitId,
  removeOfflineCheckin,
  useQueuedCheckins,
} from "@/features/visits/offline-checkin-queue";
import { VisitPhotoCollage } from "@/features/visits/visit-photo-collage";
import {
  type LocalVisitPhoto,
  clearVisitPhotos,
  photoScopeFor,
  useAllVisitPhotos,
} from "@/features/visits/visit-photos";
import { getVisitPhotos } from "@/features/visits/visit-photos-model";
import { type Visit, removeVisit, visitsQueryKey, visitsQueryOptions } from "@/features/visits/visits";
import { failedWithoutData } from "@/lib/query-failed";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";
import { cn } from "@/lib/utils";

function StatCell({
  label,
  value,
  highlight = false,
  stacked,
  divider,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  stacked: boolean;
  divider: boolean;
}) {
  return (
    <View className={cn(stacked ? undefined : "min-w-0 flex-1 flex-row items-stretch")}>
      {!stacked && divider ? <View className="my-2 w-hairline bg-border" /> : null}
      <View
        accessible
        accessibilityLabel={`${label} ${value}`}
        className={cn(
          stacked
            ? "flex-row items-center justify-between gap-3 py-1.5"
            : "min-w-0 flex-1 items-center justify-center px-1.5 py-2",
        )}
      >
        <Text variant="footnote" className="font-medium text-muted-foreground" numberOfLines={1}>
          {label}
        </Text>
        <Text
          variant="stat"
          className={cn("tabular-nums", !stacked && "mt-0.5", highlight && "text-primary")}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function VisitTimelineCard({
  visit,
  placeLabel,
  institutionSlug,
  placeSlug,
  matchedPandas,
  photos,
  isLatest,
  isQueued,
  last,
  today,
  onRemove,
}: {
  visit: Visit;
  placeLabel: string;
  institutionSlug: string | null;
  placeSlug: string | null;
  matchedPandas: PandaListItem[];
  photos: readonly LocalVisitPhoto[];
  isLatest: boolean;
  isQueued: boolean;
  last: boolean;
  today: string;
  onRemove: () => void;
}) {
  const canOpenPlace = Boolean(institutionSlug || placeSlug);
  const openPlace = () => {
    if (institutionSlug) router.push({ pathname: "/institutions/[slug]", params: { slug: institutionSlug } });
    else if (placeSlug) router.push({ pathname: "/places/[slug]", params: { slug: placeSlug } });
  };

  return (
    <View className="flex-row gap-3">
      <View className="w-5 items-center pt-3" aria-hidden importantForAccessibility="no-hide-descendants">
        <View className={cn("size-2.5 rounded-pill", isLatest ? "bg-graphic" : "bg-tertiary-foreground")} />
        {last ? null : <View className="mt-1.5 w-hairline flex-1 bg-border" />}
      </View>

      <View className={cn("min-w-0 flex-1", !last && "pb-3")}>
        <View
          className="gap-2 rounded-group border-hairline border-border bg-card p-3.5"
          style={{ borderCurve: "continuous" }}
        >
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <Text
                variant="footnote"
                className={cn("font-semibold tabular-nums", isLatest ? "text-primary" : "text-muted-foreground")}
              >
                {longDate(visit.visitedOn)}
              </Text>
              {isQueued ? (
                <Text variant="footnote" className="font-semibold text-warning">
                  暂存本机
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onRemove}
              role="button"
              hitSlop={10}
              accessibilityLabel={`删除${longDate(visit.visitedOn)}去${placeLabel}的记录`}
              className="-my-2 min-h-11 justify-center px-1 active:opacity-60"
            >
              <Text variant="footnote" className="font-medium text-muted-foreground">
                移除
              </Text>
            </Pressable>
          </View>

          {canOpenPlace ? (
            <Pressable role="link" accessibilityLabel={`查看${placeLabel}`} onPress={openPlace} className="self-start active:opacity-70">
              <Text variant="headline">{placeLabel}</Text>
            </Pressable>
          ) : (
            <Text variant="headline">{placeLabel}</Text>
          )}

          {visit.note ? (
            <Text variant="subheadline" className="text-muted-foreground">
              {`“${visit.note}”`}
            </Text>
          ) : null}

          {photos.length > 0 ? <VisitPhotoCollage photos={photos} compact /> : null}

          {matchedPandas.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pt-0.5"
            >
              {matchedPandas.map((panda) => (
                <Pressable
                  key={panda.id}
                  role="link"
                  accessibilityLabel={`查看${panda.name}`}
                  onPress={() => openPanda(panda.slug)}
                  className="min-h-11 flex-row items-center gap-1.5 rounded-pill border-hairline border-border bg-background py-1 pr-3 pl-1.5 active:opacity-75"
                  style={{ borderCurve: "continuous" }}
                >
                  <PandaThumb pandaId={panda.id} name={panda.name} size={26} />
                  <Text variant="footnote" className="font-semibold" numberOfLines={1}>
                    {panda.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : institutionSlug && visit.visitedOn === today ? (
            <Pressable
              role="link"
              accessibilityLabel={`去补记在${placeLabel}见过的熊猫`}
              onPress={() =>
                router.push({ pathname: "/institutions/[slug]/checkin", params: { slug: institutionSlug } })
              }
              className="min-h-11 flex-row items-center gap-0.5 self-start active:opacity-70"
            >
              <Text variant="footnote" className="font-semibold text-primary">
                顺手补记当天见过的熊猫
              </Text>
              <Chevron />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function VisitsScreen() {
  const { state: session } = useSession();
  const { accountId } = useAccount();
  const signedIn = accountId !== null;
  const signedOut = session.status === "signedOut";
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const network = useNetworkState();
  const isOffline = network.isConnected === false || network.isInternetReachable === false;
  const [removeFailed, setRemoveFailed] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const stacked = useStacked();
  const today = localToday();
  const photoScope = photoScopeFor(signedIn ? accountId : null);
  const photoMap = useAllVisitPhotos();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          role="link"
          accessibilityLabel="足迹地图"
          onPress={() => router.push({ pathname: "/map", params: { filter: "visited" } })}
          hitSlop={6}
          className="mr-1 min-h-11 flex-row items-center gap-1.5 rounded-pill border-hairline border-border bg-card px-3 active:opacity-70"
          style={{ borderCurve: "continuous" }}
        >
          <Icon icon={MapIcon} size="footnote" tone="tint" strokeWidth={2} />
          <Text variant="footnote" className="font-semibold" numberOfLines={1}>
            足迹地图
          </Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const remoteList = useQuery({ ...visitsQueryOptions(accountId ?? ""), enabled: signedIn });
  const guestList = useQuery({ ...guestVisitsQueryOptions(), enabled: signedOut });
  const list = signedOut ? guestList : remoteList;
  const queuedCheckins = useQueuedCheckins(signedIn ? accountId : null);

  const remoteSeen = useQuery({ ...seenEntriesQueryOptions(accountId ?? ""), enabled: signedIn });
  const guestSeen = useQuery({ ...guestSeenEntriesQueryOptions(), enabled: signedOut });
  const serverSeenEntries = (signedOut ? guestSeen.data : remoteSeen.data) ?? [];
  const seenEntries = signedIn ? mergeSeenWithQueue(serverSeenEntries, queuedCheckins) : serverSeenEntries;

  const placeList = useQuery(placesQueryOptions());
  const pandaIndex = useQuery(pandaIndexQueryOptions());
  const institutionList = useQuery(institutionListQueryOptions());

  useRefetchOnFocus(remoteList.refetch, signedIn);
  useRefetchOnFocus(remoteSeen.refetch, signedIn);

  const hasQueued = signedIn && queuedCheckins.length > 0;
  const queuedKeyByPlaceDay = useMemo(
    () => new Map(queuedCheckins.map((item) => [`${item.placeId}|${item.visitedOn}`, item.key])),
    [queuedCheckins],
  );
  const baseVisits = list.data ?? (hasQueued ? [] : null);
  const visits = baseVisits && placeList.data ? (signedIn ? mergeVisitsWithQueue(baseVisits, queuedCheckins) : baseVisits) : null;
  const placesById = placeList.data;

  const pandaIndexById = useMemo(
    () => new Map((pandaIndex.data ?? []).map((panda) => [panda.id, panda])),
    [pandaIndex.data],
  );
  const institutionSlugById = useMemo(
    () => new Map((institutionList.data ?? []).map((inst) => [inst.institutionId, inst.slug])),
    [institutionList.data],
  );

  const failed =
    session.status === "unavailable" ||
    (!hasQueued && !list.isFetching && failedWithoutData(list)) ||
    failedWithoutData(placeList);

  async function syncNow() {
    if (!accountId || syncingQueue) return;
    setSyncingQueue(true);
    try {
      await flushOfflineCheckins(accountId);
    } finally {
      setSyncingQueue(false);
    }
  }

  async function cleanupPhotosAfterRemoval(visit: Visit) {
    const stillHasPlaceDay = visits?.some(
      (item) =>
        item.checkinId !== visit.checkinId &&
        item.placeId === visit.placeId &&
        item.visitedOn === visit.visitedOn,
    );
    if (!stillHasPlaceDay) {
      await clearVisitPhotos(photoScope, visit.placeId, visit.visitedOn).catch(() => undefined);
    }
  }

  async function remove(visit: Visit) {
    setRemoveFailed(false);
    try {
      if (signedOut) {
        await removeGuestVisit(visit.checkinId);
        await cleanupPhotosAfterRemoval(visit);
        return;
      }
      const queuedKey = isQueuedVisitId(visit.checkinId)
        ? queueKeyFromVisitId(visit.checkinId)
        : queuedKeyByPlaceDay.get(`${visit.placeId}|${visit.visitedOn}`);
      if (isQueuedVisitId(visit.checkinId)) {
        if (queuedKey) await removeOfflineCheckin(queuedKey);
        await cleanupPhotosAfterRemoval(visit);
        return;
      }
      await removeVisit(visit.checkinId);
      if (queuedKey) await removeOfflineCheckin(queuedKey);
      await cleanupPhotosAfterRemoval(visit);
      if (accountId) {
        const queryKey = visitsQueryKey(accountId);
        await queryClient.cancelQueries({ queryKey });
        queryClient.setQueryData<Visit[]>(queryKey, (current) =>
          current?.filter((item) => item.checkinId !== visit.checkinId),
        );
        void queryClient.invalidateQueries({ queryKey: ["private", accountId, "book"] });
        void queryClient.invalidateQueries({ queryKey: ["private", accountId, "me-book"] });
        void queryClient.invalidateQueries({ queryKey: ["private", accountId, "milestones"] });
      }
    } catch {
      setRemoveFailed(true);
    }
  }

  const placeCount = visits ? new Set(visits.map((visit) => visit.placeId)).size : 0;
  const seenCount = new Set(seenEntries.map((entry) => entry.pandaId)).size;
  const yearGroups = useMemo(() => (visits ? groupVisitsByYear(visits) : []), [visits]);

  return (
    <Page title="去过的地点" prominent>
      {failed ? (
        <LoadFailed
          message="到访记录暂时打不开。"
          onRetry={() => {
            if (failedWithoutData(list)) void list.refetch();
            if (failedWithoutData(placeList)) void placeList.refetch();
          }}
        />
      ) : visits === null ? (
        <View className="gap-section" accessibilityLabel="正在加载到访记录">
          <View className="flex-row gap-row">
            <Skeleton className="h-16 flex-1 rounded-tile" />
            <Skeleton className="h-16 flex-1 rounded-tile" />
            <Skeleton className="h-16 flex-1 rounded-tile" />
          </View>
          <Skeleton className="h-44 w-full rounded-group" />
        </View>
      ) : visits.length === 0 ? (
        <ScreenState
          message="还没有到访记录。去场馆主页点「去过打卡」，把逛园记录和见过的熊猫收进这里。"
          actionLabel="浏览基地和动物园"
          onAction={() => router.push("/institutions")}
        />
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          <View
            className={cn(
              "border-t-hairline border-b-hairline border-border py-0.5",
              stacked ? "gap-1 py-1.5" : "flex-row items-stretch",
            )}
          >
            <StatCell label="到访" value={`${visits.length} 次`} stacked={stacked} divider={false} />
            <StatCell label="去过的地方" value={`${placeCount} 个`} stacked={stacked} divider />
            <StatCell label="现场见过" value={`${seenCount} 只`} highlight stacked={stacked} divider />
          </View>

          {hasQueued ? (
            <View
              className={cn(
                "gap-2 rounded-group border-hairline border-border bg-highlight-soft px-4 py-3",
                stacked ? "items-start" : "flex-row items-center justify-between",
              )}
              style={{ borderCurve: "continuous" }}
            >
              <View className="min-w-0 flex-1 gap-0.5">
                <Text variant="headline" className="text-primary tabular-nums">
                  {`${queuedCheckins.length} 条打卡暂存本机`}
                </Text>
                <Text variant="footnote" className="text-muted-foreground">
                  {isOffline ? "待联网后自动同步" : "网络已恢复，可点按立即同步"}
                </Text>
              </View>
              {isOffline ? null : (
                <Pressable
                  role="button"
                  accessibilityLabel="立即同步暂存打卡"
                  disabled={syncingQueue}
                  onPress={() => void syncNow()}
                  className="min-h-11 justify-center rounded-control border-hairline border-border bg-card px-3 active:opacity-70"
                  style={{ borderCurve: "continuous" }}
                >
                  <Text variant="footnote" className="font-semibold text-primary">
                    {syncingQueue ? "正在同步…" : "立即同步"}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {removeFailed ? (
            <Text variant="footnote" className="px-inset text-destructive" accessibilityLiveRegion="polite">
              没能移除，请再试一次。
            </Text>
          ) : null}

          <View className="gap-section-tight">
            {yearGroups.map((group, groupIndex) => (
              <View key={group.year} className="gap-2.5">
                <Text variant="footnote" role="heading" className="px-1 text-muted-foreground tabular-nums">
                  {`${group.year} 年看猫手账　${group.visits.length} 次`}
                </Text>
                <View>
                  {group.visits.map((visit, index) => {
                    const place = placesById?.get(visit.placeId);
                    const placeLabel = placeName(place) ?? place?.nameEn ?? place?.slug ?? "一个地点";
                    const institutionSlug = place?.institutionId
                      ? (institutionSlugById.get(place.institutionId) ?? null)
                      : null;
                    const matchedPandas = matchSeenPandasForVisit(visit, seenEntries, pandaIndexById);
                    const photos = getVisitPhotos(photoMap, photoScope, visit.placeId, visit.visitedOn);
                    return (
                      <VisitTimelineCard
                        key={visit.checkinId}
                        visit={visit}
                        placeLabel={placeLabel}
                        institutionSlug={institutionSlug}
                        placeSlug={place?.slug ?? null}
                        matchedPandas={matchedPandas}
                        photos={photos}
                        isLatest={groupIndex === 0 && index === 0}
                        isQueued={isQueuedVisitId(visit.checkinId) || queuedKeyByPlaceDay.has(`${visit.placeId}|${visit.visitedOn}`)}
                        last={index === group.visits.length - 1}
                        today={today}
                        onRemove={() => void remove(visit)}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          <Text variant="footnote" className="text-center text-muted-foreground">
            手账实拍仅存本机应用隐私目录　卸载前可通过票根长图保存
          </Text>
        </Animated.View>
      )}
    </Page>
  );
}
