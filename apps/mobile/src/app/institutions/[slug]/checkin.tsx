import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useNetworkState } from "expo-network";
import { Stack, router, useLocalSearchParams, useNavigation } from "expo-router";
import { HeaderBackButton } from "expo-router/react-navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/chip";
import { ListSection, useSingleColumn, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Check, Landmark, MapPinCheck, Photo, X } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { RemoteImage } from "@/components/remote-image";
import { ScreenState } from "@/components/screen-state";
import { Scrim } from "@/components/scrim";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import {
  guestSeenEntriesQueryKey,
  guestSeenQueryKey,
  guestVisitsQueryKey,
  guestVisitsQueryOptions,
  markGuestSeen,
  recordGuestVisit,
} from "@/features/engagement/guest-store";
import {
  localToday,
  markSeen,
  seenEntriesQueryKey,
  seenIdsQueryKey,
} from "@/features/engagement/seen";
import { useSeenIds } from "@/features/engagement/use-seen-ids";
import { institutionQueryOptions } from "@/features/institutions/institutions";
import { splitResidentsByCover } from "@/features/institutions/resident-filter";
import { type PandaListItem, searchPandas } from "@/features/pandas/pandas";
import { longDate } from "@/features/pandas/profile";
import { SearchField } from "@/features/pandas/search-field";
import { useSession } from "@/features/session/session";
import {
  enqueueOfflineCheckin,
  mergeVisitsWithQueue,
  useQueuedCheckins,
} from "@/features/visits/offline-checkin-queue";
import { SouvenirTicket } from "@/features/visits/souvenir-ticket";
import {
  type LocalVisitPhoto,
  MAX_VISIT_PHOTOS,
  photoScopeFor,
  pickAndPrepareVisitPhotos,
  saveVisitPhotos,
  useVisitPhotos,
} from "@/features/visits/visit-photos";
import { type Visit, recordVisit, sortVisits, visitsQueryKey, visitsQueryOptions } from "@/features/visits/visits";
import { usePandaCover } from "@/lib/covers";
import { selectionHaptic, successHaptic } from "@/lib/haptics";
import { HAIRLINE, PAGE_COLUMN, RADIUS, pageColumn } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";
import { cn } from "@/lib/utils";

type CheckinFilter = "unseenFirst" | "all";

const GRID_GAP = semantic.spacing.stackTight.value;
const CHECK_BADGE = 22;
const COMPACT_AVATAR = 40;
const NOTE_MAX = 120;
const EMPTY_PHOTOS: LocalVisitPhoto[] = [];

function ResidentCheckTile({
  panda,
  width,
  selected,
  wasSeen,
  onToggle,
}: {
  panda: PandaListItem;
  width: number;
  selected: boolean;
  wasSeen: boolean;
  onToggle: () => void;
}) {
  const colors = useIOSColors();
  const photo = usePandaCover(panda.id);
  const height = Math.round((width * 5) / 4);

  return (
    <PressScale
      role="checkbox"
      aria-checked={selected}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${panda.name}${wasSeen ? "，此前见过" : ""}${selected ? "，已选中" : ""}`}
      onPress={onToggle}
      style={{ width, height }}
    >
      <View
        className={cn(
          "flex-1 overflow-hidden rounded-tile bg-media-placeholder",
          selected && "border-2 border-primary",
        )}
        style={{ borderCurve: "continuous" }}
      >
        {photo ? (
          <RemoteImage
            source={photo}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            accessible={false}
            transition={200}
          />
        ) : null}
        <Scrim id={`checkin-tile-${panda.id}`} height="54%" />

        <View className="absolute top-2 right-2 left-2 flex-row items-start justify-between gap-1">
          {wasSeen ? (
            <View className="rounded-pill bg-glass-fallback px-1.5 py-0.5">
              <Text variant="footnote" role="none" className="text-on-media">
                此前见过
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View
            aria-hidden
            className="items-center justify-center rounded-pill"
            style={{
              width: CHECK_BADGE,
              height: CHECK_BADGE,
              backgroundColor: selected ? colors.tint : colors.glassFallback,
              borderWidth: selected ? 0 : 1.5,
              borderColor: colors.onMedia,
            }}
          >
            {selected ? <Icon icon={Check} size={13} tone="onButton" strokeWidth={2.5} /> : null}
          </View>
        </View>

        <View className="absolute right-0 bottom-0 left-0 p-2">
          <Text variant="subheadline" role="none" className="font-bold text-on-media" numberOfLines={1}>
            {panda.name}
          </Text>
        </View>

        {selected ? null : <PhotoOutline radius={RADIUS.tile} />}
      </View>
    </PressScale>
  );
}

function ResidentCheckRow({
  panda,
  selected,
  wasSeen,
  last,
  onToggle,
}: {
  panda: PandaListItem;
  selected: boolean;
  wasSeen: boolean;
  last: boolean;
  onToggle: () => void;
}) {
  const birthYear = panda.birthDate ? `${panda.birthDate.slice(0, 4)} 年出生` : null;
  const detail = [birthYear, wasSeen ? "此前见过" : null].filter(Boolean).join("　");

  return (
    <View>
      <Pressable
        role="checkbox"
        aria-checked={selected}
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${panda.name}${wasSeen ? "，此前见过" : ""}${selected ? "，已选中" : ""}`}
        onPress={onToggle}
        className={cn(
          "min-h-11 flex-row items-center gap-row px-inset py-2.5 active:bg-accent",
          selected && "bg-highlight-soft",
        )}
      >
        <PandaThumb pandaId={panda.id} name={panda.name} size={COMPACT_AVATAR} shape="round" />
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="headline" numberOfLines={1}>
            {panda.name}
          </Text>
          {detail ? (
            <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        {selected ? (
          <Icon icon={Check} size="body" tone="tint" strokeWidth={2.5} />
        ) : (
          <View className="size-5 rounded-pill border border-border" aria-hidden />
        )}
      </Pressable>
      {last ? null : (
        <View className="bg-border" style={[{ height: HAIRLINE }, { marginLeft: 16 + COMPACT_AVATAR + 12 }]} />
      )}
    </View>
  );
}

interface CompletedCheckin {
  facilityId: string;
  facilityName: string;
  visitedOn: string;
  visitCount: number;
  note: string | null;
  photos: LocalVisitPhoto[];
  newlyLitPandas: PandaListItem[];
  updatedSeenIds: ReadonlySet<string>;
  queuedOffline: boolean;
}

export default function VenueCheckinScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useIOSColors();
  const stacked = useStacked();
  const singleColumn = useSingleColumn();
  const queryClient = useQueryClient();
  const network = useNetworkState();
  const isOffline = network.isConnected === false || network.isInternetReachable === false;
  const { state: session } = useSession();

  const signedIn = session.status === "signedIn";
  const signedOut = session.status === "signedOut";
  const accountId = signedIn ? session.accountId : "";
  const photoScope = photoScopeFor(signedIn ? accountId : null);
  const today = localToday();

  const { data: institution, isError, isFetching, refetch } = useQuery(institutionQueryOptions(slug));
  const seenIds = useSeenIds();
  const remoteVisits = useQuery({ ...visitsQueryOptions(accountId), enabled: signedIn });
  const guestVisits = useQuery({ ...guestVisitsQueryOptions(), enabled: signedOut });
  const queuedVisits = useQueuedCheckins(signedIn ? accountId : null);
  useRefetchOnFocus(remoteVisits.refetch, signedIn);

  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<CheckinFilter>("unseenFirst");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [sessionSavedIds, setSessionSavedIds] = useState<string[]>([]);
  const [draftPhotosByFacility, setDraftPhotosByFacility] = useState<Record<string, LocalVisitPhoto[]>>({});
  const [pickingPhotos, setPickingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedCheckin | null>(null);
  const savedVisitRef = useRef<{ placeId: string; visitedOn: string; note: string } | null>(null);

  function goBackToVenue() {
    if (navigation.canGoBack()) router.back();
    else router.replace({ pathname: "/institutions/[slug]", params: { slug } });
  }

  useLayoutEffect(() => {
    const needsBack = !navigation.canGoBack();
    navigation.setOptions({
      title: completed ? "今日逛园战绩" : "今日逛园打卡",
      headerLeft: needsBack
        ? (props: { tintColor?: string }) => (
            <HeaderBackButton
              {...props}
              label="返回"
              accessibilityLabel="返回"
              onPress={() => router.replace({ pathname: "/institutions/[slug]", params: { slug } })}
            />
          )
        : undefined,
    });
  }, [completed, navigation, slug]);

  const facility = useMemo(() => {
    if (!institution || institution.facilities.length === 0) return null;
    return institution.facilities.find((item) => item.id === selectedFacilityId) ?? institution.facilities[0] ?? null;
  }, [institution, selectedFacilityId]);

  const savedFacilityPhotos = useVisitPhotos(photoScope, facility?.id ?? null, today);
  const draftPhotos = facility ? (draftPhotosByFacility[facility.id] ?? savedFacilityPhotos) : EMPTY_PHOTOS;

  const orderedResidents = useMemo(() => {
    const residents = institution?.residents ?? [];
    if (filter === "all" || !seenIds) return residents;
    const unseen = residents.filter((panda) => !seenIds.has(panda.id));
    const seen = residents.filter((panda) => seenIds.has(panda.id));
    return [...unseen, ...seen];
  }, [filter, institution?.residents, seenIds]);

  const visibleResidents = useMemo(
    () => searchPandas(orderedResidents, query),
    [orderedResidents, query],
  );
  const { featured, compact } = useMemo(() => splitResidentsByCover(visibleResidents), [visibleResidents]);

  const columns = singleColumn ? 2 : 3;
  const tileWidth = Math.floor((pageColumn(width) - GRID_GAP * (columns - 1)) / columns);
  const photoInnerWidth = Math.max(200, pageColumn(width) - semantic.spacing.inset.value * 2);
  const photoSlotSize = Math.floor((photoInnerWidth - GRID_GAP * (MAX_VISIT_PHOTOS - 1)) / MAX_VISIT_PHOTOS);

  function togglePanda(pandaId: string) {
    selectionHaptic();
    setErrorMessage(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pandaId)) next.delete(pandaId);
      else next.add(pandaId);
      return next;
    });
  }

  async function handlePickPhotos() {
    if (!facility || pickingPhotos) return;
    const targetFacilityId = facility.id;
    const existingList = draftPhotosByFacility[targetFacilityId] ?? savedFacilityPhotos;
    const remaining = MAX_VISIT_PHOTOS - existingList.length;
    if (remaining <= 0) return;

    setPickingPhotos(true);
    setPhotoError(null);
    try {
      const picked = await pickAndPrepareVisitPhotos(remaining);
      if (picked.length > 0) {
        selectionHaptic();
        setDraftPhotosByFacility((prev) => {
          const base = prev[targetFacilityId] ?? savedFacilityPhotos;
          return {
            ...prev,
            [targetFacilityId]: [...base, ...picked].slice(0, MAX_VISIT_PHOTOS),
          };
        });
      }
    } catch {
      setPhotoError("没能读取这张照片，换一张或再试一次。");
    } finally {
      setPickingPhotos(false);
    }
  }

  function handleRemoveDraftPhoto(index: number) {
    if (!facility) return;
    const targetFacilityId = facility.id;
    selectionHaptic();
    setPhotoError(null);
    setDraftPhotosByFacility((prev) => {
      const base = prev[targetFacilityId] ?? savedFacilityPhotos;
      return {
        ...prev,
        [targetFacilityId]: base.filter((_, idx) => idx !== index),
      };
    });
  }

  async function saveCheckin() {
    if (!institution || !facility || saving) return;
    if (!signedIn && !signedOut) {
      setErrorMessage("账号状态暂不可用，请稍后再试。");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const serverVisits = (signedOut ? guestVisits.data : remoteVisits.data) ?? [];
    const existingVisits = signedIn ? mergeVisitsWithQueue(serverVisits, queuedVisits) : serverVisits;
    const facilityIds = new Set(institution.facilities.map((item) => item.id));
    const trimmedNote = note.trim();
    const alreadyVisitedToday = existingVisits.some(
      (visit) => visit.placeId === facility.id && visit.visitedOn === today,
    );
    const sameAttemptVisitSaved =
      savedVisitRef.current?.placeId === facility.id &&
      savedVisitRef.current?.visitedOn === today &&
      savedVisitRef.current?.note === trimmedNote;

    const targetIds = [...selectedIds];
    const needsVisitWrite = !sameAttemptVisitSaved && (!alreadyVisitedToday || trimmedNote.length > 0);
    const baseVisitSynced = existingVisits.some(
      (v) => v.placeId === facility.id && v.visitedOn === today && !v.checkinId.startsWith("queued:"),
    );

    const hasPhotoChanges = facility.id in draftPhotosByFacility || draftPhotos.length > 0;
    const completeCheckin = async (litIds: readonly string[], visitCountDelta: number, queuedOffline: boolean) => {
      let persistedPhotos = draftPhotos;
      if (hasPhotoChanges) {
        try {
          persistedPhotos = await saveVisitPhotos(photoScope, facility.id, today, draftPhotos);
        } catch {
          persistedPhotos = draftPhotos;
        }
      }
      const litSet = new Set(litIds);
      const newlyLitPandas = institution.residents.filter((panda) => litSet.has(panda.id));
      const updatedSeenIds = new Set([...(seenIds ?? []), ...litIds]);
      const priorVenueVisits = existingVisits.filter((visit) => facilityIds.has(visit.placeId)).length;
      const visitCount = priorVenueVisits + (visitCountDelta > 0 && !alreadyVisitedToday ? 1 : 0);

      successHaptic();
      setSaving(false);
      setCompleted({
        facilityId: facility.id,
        facilityName: facility.name,
        visitedOn: today,
        visitCount: Math.max(1, visitCount),
        note: trimmedNote || null,
        photos: persistedPhotos,
        newlyLitPandas,
        updatedSeenIds,
        queuedOffline,
      });
    };

    const queueAndComplete = async (
      visitSynced: boolean,
      pendingIds: readonly string[],
      litIds: readonly string[],
      visitCountDelta: number,
    ) => {
      await enqueueOfflineCheckin({
        accountId,
        placeId: facility.id,
        visitedOn: today,
        note: trimmedNote || null,
        visitSynced,
        pandaIds: pendingIds,
      });
      await completeCheckin([...new Set([...sessionSavedIds, ...litIds])], visitCountDelta, true);
    };

    if (signedIn && isOffline) {
      await queueAndComplete(!needsVisitWrite && baseVisitSynced, targetIds, targetIds, needsVisitWrite ? 1 : 0);
      return;
    }

    let recordedNewVisit = false;
    let visitWriteFailed = false;
    if (needsVisitWrite) {
      try {
        if (signedOut) {
          await recordGuestVisit(facility.id, today, trimmedNote || null);
        } else {
          const visit = await recordVisit(facility.id, today, trimmedNote || null);
          const key = visitsQueryKey(accountId);
          await queryClient.cancelQueries({ queryKey: key });
          queryClient.setQueryData<Visit[]>(key, (current) => sortVisits([visit, ...(current ?? [])]));
        }
        savedVisitRef.current = { placeId: facility.id, visitedOn: today, note: trimmedNote };
        recordedNewVisit = true;
      } catch {
        if (signedIn) {
          visitWriteFailed = true;
        } else {
          setSaving(false);
          setErrorMessage("没能记下这次逛园打卡，请检查网络后再试一次。");
          return;
        }
      }
    }

    if (signedIn && visitWriteFailed) {
      await queueAndComplete(false, targetIds, targetIds, 1);
      return;
    }

    const results = await Promise.allSettled(
      targetIds.map(async (pandaId) => {
        if (signedOut) {
          await markGuestSeen(pandaId, today, facility.id);
          return pandaId;
        }
        const ok = await markSeen(pandaId, today, facility.id);
        if (!ok) throw new Error(`Failed to mark ${pandaId} seen`);
        return pandaId;
      }),
    );

    const succeededIds: string[] = [];
    const failedIds: string[] = [];
    results.forEach((result, index) => {
      const id = targetIds[index]!;
      if (result.status === "fulfilled") succeededIds.push(id);
      else failedIds.push(id);
    });

    if (signedIn && accountId) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: visitsQueryKey(accountId) }),
        ...(succeededIds.length > 0
          ? [
              queryClient.invalidateQueries({ queryKey: seenIdsQueryKey(accountId) }),
              queryClient.invalidateQueries({ queryKey: seenEntriesQueryKey(accountId) }),
              queryClient.invalidateQueries({ queryKey: ["private", accountId, "book"] }),
              queryClient.invalidateQueries({ queryKey: ["private", accountId, "me-book"] }),
              queryClient.invalidateQueries({ queryKey: ["private", accountId, "milestones"] }),
              ...succeededIds.map((pandaId) =>
                queryClient.invalidateQueries({ queryKey: ["private", accountId, "seen", pandaId] }),
              ),
            ]
          : []),
      ]);
    } else if (signedOut) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: guestVisitsQueryKey }),
        ...(succeededIds.length > 0
          ? [
              queryClient.invalidateQueries({ queryKey: guestSeenQueryKey }),
              queryClient.invalidateQueries({ queryKey: guestSeenEntriesQueryKey }),
            ]
          : []),
      ]);
    }

    if (signedIn && failedIds.length > 0) {
      await queueAndComplete(true, failedIds, [...succeededIds, ...failedIds], recordedNewVisit ? 1 : 0);
      return;
    }

    const combinedSavedIds = [...new Set([...sessionSavedIds, ...succeededIds])];
    if (failedIds.length > 0) {
      const byId = new Map(institution.residents.map((panda) => [panda.id, panda.name]));
      const failedNames = failedIds
        .slice(0, 3)
        .map((id) => byId.get(id) ?? "熊猫")
        .join("、");
      setSessionSavedIds(combinedSavedIds);
      setSelectedIds(new Set(failedIds));
      setSaving(false);
      setErrorMessage(
        failedIds.length <= 3
          ? `场馆已记录，但「${failedNames}」未保存成功，已为你保留勾选，点按下方按钮重试。`
          : `场馆已记录，但有 ${failedIds.length} 只熊猫未保存成功（含 ${failedNames} 等），已为你保留勾选，点按下方按钮重试。`,
      );
      return;
    }

    await completeCheckin(combinedSavedIds, recordedNewVisit ? 1 : 0, false);
  }

  if (!institution) {
    return (
      <View className="flex-1 bg-background px-gutter pt-6">
        <Stack.Screen options={{ title: "今日逛园打卡" }} />
        {isError && !isFetching ? (
          <View style={PAGE_COLUMN}>
            <LoadFailed message="场馆信息暂时打不开。" onRetry={() => void refetch()} />
          </View>
        ) : (
          <View className="gap-4" style={PAGE_COLUMN} accessibilityLabel="正在加载">
            <Skeleton className="h-28 w-full rounded-group" />
            <Skeleton className="h-11 w-full rounded-control" />
            <View className="flex-row gap-2">
              <Skeleton className="aspect-square flex-1 rounded-tile" />
              <Skeleton className="aspect-square flex-1 rounded-tile" />
              <Skeleton className="aspect-square flex-1 rounded-tile" />
            </View>
          </View>
        )}
      </View>
    );
  }

  if (!facility) {
    return (
      <View className="flex-1 bg-background px-gutter pt-8">
        <Stack.Screen options={{ title: "今日逛园打卡" }} />
        <View style={PAGE_COLUMN}>
          <ScreenState message="这家场馆暂时没有可打卡的园区。" actionLabel="返回场馆页" onAction={goBackToVenue} />
        </View>
      </View>
    );
  }

  if (completed) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="px-gutter pt-4"
        contentContainerStyle={[PAGE_COLUMN, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
      >
        <Stack.Screen options={{ title: "今日逛园战绩" }} />
        <SouvenirTicket
          institution={institution}
          facilityName={completed.facilityName}
          visitedOn={completed.visitedOn}
          visitCount={completed.visitCount}
          note={completed.note}
          photos={completed.photos}
          newlyLitPandas={completed.newlyLitPandas}
          seenIds={completed.updatedSeenIds}
          queuedOffline={completed.queuedOffline}
          onDone={goBackToVenue}
        />
      </ScrollView>
    );
  }

  const residents = institution.residents;
  const ctaParts = [
    selectedIds.size > 0 ? ` ＋ ${selectedIds.size} 只见过` : "",
    draftPhotos.length > 0 ? ` ＋ ${draftPhotos.length} 张照片` : "",
  ].join("");
  const ctaLabel = `保存本次打卡　1 场馆${ctaParts}`;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: "今日逛园打卡" }} />

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-5 px-gutter pt-4 pb-8"
        contentContainerStyle={PAGE_COLUMN}
      >
        {/* Venue header + facility picker + optional note */}
        <View
          className="gap-3 rounded-group border-hairline border-border bg-card p-inset"
          style={{ borderCurve: "continuous" }}
        >
          <View className={cn("gap-2", stacked ? "items-start" : "flex-row items-center justify-between")}>
            <View className={cn("flex-row items-center gap-2", !stacked && "min-w-0 flex-1")}>
              <Icon icon={Landmark} size="subhead" tone="tint" strokeWidth={2} />
              <Text variant="headline" className={cn(!stacked && "min-w-0 flex-1")} numberOfLines={stacked ? undefined : 2}>
                {institution.name}
              </Text>
            </View>
            <Text variant="footnote" className="shrink-0 text-muted-foreground tabular-nums">
              {longDate(today)}
            </Text>
          </View>

          {institution.facilities.length > 1 ? (
            <View className="gap-1.5">
              <Text variant="footnote" className="text-muted-foreground">
                打卡园区
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {institution.facilities.map((item) => (
                  <Chip
                    key={item.id}
                    label={item.name}
                    appearance="ink"
                    selected={item.id === facility.id}
                    onPress={() => {
                      selectionHaptic();
                      setSelectedFacilityId(item.id);
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View
            className="rounded-control border-hairline border-border bg-background px-3"
            style={{ borderCurve: "continuous" }}
          >
            <TextInput
              value={note}
              onChangeText={(value) => setNote(value.slice(0, NOTE_MAX))}
              placeholder="写一句今天的看猫小记（可选）"
              placeholderTextColor={colors.secondaryLabel}
              accessibilityLabel="看猫小记"
              maxLength={NOTE_MAX}
              returnKeyType="done"
              className="min-h-11 py-2 text-subheadline text-foreground"
            />
          </View>

          <View className="gap-2 pt-0.5">
            <View className={cn("gap-1", stacked ? "items-start" : "flex-row items-center justify-between")}>
              <Text variant="footnote" className="font-semibold text-foreground">
                附上实拍照片
              </Text>
              <Text variant="footnote" className="text-muted-foreground tabular-nums">
                {`已选 ${draftPhotos.length} / ${MAX_VISIT_PHOTOS} 张　仅存本机`}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {draftPhotos.map((photo, index) => (
                <View
                  key={photo.id}
                  className="overflow-hidden rounded-control border-hairline border-border bg-media-placeholder"
                  style={{ width: photoSlotSize, height: photoSlotSize, borderCurve: "continuous" }}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    transition={0}
                    accessible
                    accessibilityLabel={`已选第 ${index + 1} 张实拍`}
                  />
                  <Pressable
                    role="button"
                    accessibilityLabel={`移除第 ${index + 1} 张实拍`}
                    hitSlop={8}
                    onPress={() => handleRemoveDraftPhoto(index)}
                    className="absolute top-1 right-1 size-6 items-center justify-center rounded-pill bg-glass-fallback active:opacity-75"
                  >
                    <Icon icon={X} size={12} tone="onMedia" strokeWidth={2.5} />
                  </Pressable>
                </View>
              ))}
              {draftPhotos.length < MAX_VISIT_PHOTOS ? (
                <Pressable
                  role="button"
                  accessibilityLabel="添加实拍照片"
                  disabled={pickingPhotos}
                  onPress={() => void handlePickPhotos()}
                  className={cn(
                    "items-center justify-center gap-1 rounded-control border-hairline border-border bg-background active:opacity-75",
                    pickingPhotos && "opacity-50",
                  )}
                  style={{ width: photoSlotSize, height: photoSlotSize, borderCurve: "continuous" }}
                >
                  <Icon icon={Photo} size="subhead" tone="tint" strokeWidth={2} />
                  <Text variant="footnote" className="font-medium text-muted-foreground">
                    {pickingPhotos ? "处理中" : "添实拍"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {photoError ? (
              <Text variant="footnote" className="text-destructive" accessibilityLiveRegion="polite">
                {photoError}
              </Text>
            ) : null}
          </View>
        </View>

        {residents.length === 0 ? (
          <ScreenState message="这家场馆目前没有记录在馆大熊猫，可直接保存今日到访。" className="py-4" />
        ) : (
          <View className="gap-3">
            <View className={cn("gap-2", stacked ? "items-start" : "flex-row items-center justify-between")}>
              <View className="flex-row items-baseline gap-2">
                <Text variant="headline" role="heading">
                  点选见过的熊猫
                </Text>
                {selectedIds.size > 0 ? (
                  <Text variant="footnote" className="font-semibold text-primary tabular-nums">
                    {`已选 ${selectedIds.size} 只`}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label="未见过优先"
                  appearance="ink"
                  selected={filter === "unseenFirst"}
                  onPress={() => setFilter("unseenFirst")}
                />
                <Chip
                  label={`全部 ${residents.length}`}
                  appearance="ink"
                  selected={filter === "all"}
                  onPress={() => setFilter("all")}
                />
              </View>
            </View>

            {residents.length >= 6 ? (
              <SearchField
                value={query}
                onChange={setQuery}
                label="搜索馆内熊猫"
                placeholder="搜名字或 #谱系号…"
              />
            ) : null}

            {visibleResidents.length === 0 ? (
              <ScreenState message="没有找到符合条件的熊猫。" className="py-4" />
            ) : (
              <View className="gap-4">
                {featured.length > 0 ? (
                  <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
                    {featured.map((panda) => (
                      <ResidentCheckTile
                        key={panda.id}
                        panda={panda}
                        width={tileWidth}
                        selected={selectedIds.has(panda.id)}
                        wasSeen={Boolean(seenIds?.has(panda.id))}
                        onToggle={() => togglePanda(panda.id)}
                      />
                    ))}
                  </View>
                ) : null}

                {compact.length > 0 ? (
                  <ListSection title={featured.length > 0 ? "暂无单图封面的住客" : undefined}>
                    {compact.map((panda, index) => (
                      <ResidentCheckRow
                        key={panda.id}
                        panda={panda}
                        selected={selectedIds.has(panda.id)}
                        wasSeen={Boolean(seenIds?.has(panda.id))}
                        last={index === compact.length - 1}
                        onToggle={() => togglePanda(panda.id)}
                      />
                    ))}
                  </ListSection>
                ) : null}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom save bar */}
      <View
        className="border-t-hairline border-border bg-background px-gutter pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View style={PAGE_COLUMN} className="gap-2">
          {errorMessage ? (
            <Text variant="footnote" className="text-destructive" accessibilityLiveRegion="polite">
              {errorMessage}
            </Text>
          ) : null}
          <Button
            onPress={() => void saveCheckin()}
            disabled={saving || (!signedIn && !signedOut)}
            accessibilityLabel={ctaLabel}
          >
            <Icon icon={MapPinCheck} size="subhead" tone="onButton" strokeWidth={2} />
            <Text className="tabular-nums" numberOfLines={1}>
              {saving ? "正在保存打卡…" : ctaLabel}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
