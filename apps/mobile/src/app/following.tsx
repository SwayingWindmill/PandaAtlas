import type { components } from "@zhipanda/api-client";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Heart, Landmark, Video } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Segmented } from "@/components/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useFollowed } from "@/features/engagement/favorites";
import { useFollowVenue, useFollowedVenues } from "@/features/engagement/followed-venues";
import { VENUE_CLOCK_SPECS } from "@/features/explore/venue-clock";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { mapViewQueryOptions } from "@/features/map/load";
import type { MapItem } from "@/features/map/model";
import { PandaRow } from "@/features/pandas/panda-row";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { VenueActivityBar, venueStatusColorOf } from "@/features/viewing/venue-live-card";
import { buildVenueLiveSnapshot, resolveVenueLiveCamUrl } from "@/features/viewing/venue-live";
import { failedWithoutData } from "@/lib/query-failed";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

type FollowingTab = "pandas" | "venues";
type InstitutionDto = components["schemas"]["PublicInstitutionSummaryDto"];

const COUNTRY_NAME: Record<string, string> = {
  CN: "中国",
  US: "美国",
  JP: "日本",
  KR: "韩国",
  GB: "英国",
  DE: "德国",
  FR: "法国",
};
const VENUE_THUMB = 54;

function FollowedVenueCard({
  institution,
  mapItem,
  now,
}: {
  institution: InstitutionDto;
  mapItem: MapItem | undefined;
  now: Date;
}) {
  const colors = useIOSColors();
  const stacked = useStacked();
  const { toggle } = useFollowVenue(institution.slug);
  const name = institution.nameZh ?? institution.nameEn ?? institution.slug;
  const lead = mapItem?.residents.find((resident) => resident.hasFullBleedCover) ?? mapItem?.residents[0];
  const residentCount = mapItem?.residentCount ?? 0;
  const country = institution.countryCode ? (COUNTRY_NAME[institution.countryCode] ?? mapItem?.where ?? null) : (mapItem?.where ?? null);
  const subMeta = [country, residentCount > 0 ? `${residentCount} 只在馆` : null].filter(Boolean).join("　");

  const hasClock = Object.hasOwn(VENUE_CLOCK_SPECS, institution.slug);
  const snapshot = hasClock ? buildVenueLiveSnapshot(institution.slug, institution.profile?.liveCamUrl ?? null, now) : null;
  const liveCamUrl = resolveVenueLiveCamUrl(institution.slug, institution.profile?.liveCamUrl ?? null);
  const statusColor = snapshot ? venueStatusColorOf(snapshot.status, colors) : colors.secondaryLabel;
  const openVenue = () => router.push({ pathname: "/institutions/[slug]", params: { slug: institution.slug } });

  return (
    <View
      className="gap-3 rounded-group border-hairline border-border bg-card p-3.5"
      style={{ borderCurve: "continuous" }}
    >
      <Pressable
        role="link"
        accessibilityLabel={`${name}${subMeta ? `，${subMeta}` : ""}`}
        onPress={openVenue}
        className="flex-row items-center gap-3 active:opacity-75"
      >
        {lead ? (
          <PandaThumb pandaId={lead.id} name={lead.name} size={VENUE_THUMB} />
        ) : (
          <View className="items-center justify-center" style={{ width: VENUE_THUMB, height: VENUE_THUMB }}>
            <Icon icon={Landmark} size="title3" tone="secondary" />
          </View>
        )}

        <View className="min-w-0 flex-1 gap-0.5">
          {snapshot ? (
            <View className="flex-row items-center gap-1.5">
              <View className="size-2 rounded-pill" style={{ backgroundColor: statusColor }} />
              <Text variant="footnote" className="font-semibold tabular-nums" style={{ color: statusColor }} numberOfLines={1}>
                {`当地 ${snapshot.localTime}　${snapshot.statusLabel}${snapshot.status === "closed" ? `　${snapshot.openLabel}` : ""}`}
              </Text>
            </View>
          ) : null}

          <Text variant="headline" numberOfLines={stacked ? undefined : 2}>
            {name}
          </Text>

          {subMeta ? (
            <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
              {subMeta}
            </Text>
          ) : null}
        </View>

        {stacked ? null : <Chevron />}
      </Pressable>

      {snapshot ? (
        <VenueActivityBar snapshot={snapshot} dotColor={statusColor} cardColor={colors.card} compact />
      ) : null}

      <View className={cn("flex-row flex-wrap items-center justify-between gap-2", stacked && "items-start")}>
        <Pressable
          role="button"
          accessibilityLabel={`取消关注${name}`}
          onPress={toggle}
          className="-my-1 min-h-11 flex-row items-center gap-1.5 active:opacity-70"
        >
          <Icon icon={Heart} size="footnote" tone="tint" strokeWidth={2} />
          <Text variant="footnote" className="font-semibold text-muted-foreground">
            已关注场馆
          </Text>
        </Pressable>

        <View className="flex-row flex-wrap items-center gap-2">
          <Pressable
            role="link"
            accessibilityLabel={`查看${name}攻略`}
            onPress={openVenue}
            hitSlop={6}
            className="-my-1 min-h-11 flex-row items-center gap-0.5 active:opacity-60"
          >
            <Text variant="footnote" className="font-semibold text-primary">
              查看攻略
            </Text>
            <Chevron />
          </Pressable>

          {liveCamUrl ? (
            <Pressable
              role="link"
              accessibilityLabel={`看${name}官方直播`}
              accessibilityHint="在浏览器中打开"
              onPress={() => void Linking.openURL(liveCamUrl)}
              hitSlop={6}
              className="-my-1 min-h-11 justify-center active:opacity-75"
            >
              <View className="flex-row items-center gap-1 rounded-pill bg-highlight-soft px-3 py-1.5">
                <Icon icon={Video} size="footnote" tone="tint" strokeWidth={2} />
                <Text variant="footnote" className="font-semibold text-primary">
                  看直播
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** 我的关注: dual-tab view for followed pandas (default) and followed panda venues with live activity bars. */
export default function FollowingScreen() {
  const [tab, setTab] = useState<FollowingTab>("pandas");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const followed = useFollowed();
  const followedVenues = useFollowedVenues();

  const index = useQuery(pandaIndexQueryOptions());
  const institutions = useQuery(institutionListQueryOptions());
  const mapView = useQuery(mapViewQueryOptions());

  const pandaItems = useMemo(
    () => (followed && index.data ? index.data.filter((panda) => followed.has(panda.id)) : null),
    [followed, index.data],
  );
  const venueItems = useMemo(
    () => (followedVenues && institutions.data ? institutions.data.filter((inst) => followedVenues.has(inst.slug)) : null),
    [followedVenues, institutions.data],
  );
  const mapBySlug = useMemo(() => {
    const map = new Map<string, MapItem>();
    for (const item of mapView.data?.items ?? []) {
      if (item.kind === "institution") map.set(item.slug, item);
    }
    return map;
  }, [mapView.data?.items]);

  const pandaCount = pandaItems?.length ?? followed?.size ?? 0;
  const venueCount = venueItems?.length ?? followedVenues?.size ?? 0;

  const pandaFailed = failedWithoutData(index);
  const venueFailed = failedWithoutData(institutions);

  return (
    <Page title="我的关注">
      <Segmented
        value={tab}
        onChange={setTab}
        accessibilityLabel="关注分类"
        options={[
          { value: "pandas", label: `熊猫 ${pandaCount}` },
          { value: "venues", label: `场馆 ${venueCount}` },
        ]}
      />

      {tab === "pandas" ? (
        <>
          {pandaFailed ? <LoadFailed message="关注的熊猫暂时打不开。" onRetry={() => void index.refetch()} /> : null}
          {!pandaFailed && pandaItems === null ? (
            <Skeleton className="h-72 w-full rounded-group" accessibilityLabel="正在加载" />
          ) : null}
          {pandaItems && pandaItems.length === 0 ? (
            <ScreenState
              message="在熊猫资料页点「关注」，它们会排在这里。"
              actionLabel="找熊猫"
              onAction={() => router.push("/find")}
            />
          ) : null}
          {pandaItems && pandaItems.length > 0 ? (
            <View>
              {pandaItems.map((panda, idx) => (
                <PandaRow key={panda.id} item={panda} first={idx === 0} last={idx === pandaItems.length - 1} />
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {venueFailed ? <LoadFailed message="关注的场馆暂时打不开。" onRetry={() => void institutions.refetch()} /> : null}
          {!venueFailed && venueItems === null ? (
            <View className="gap-3" accessibilityLabel="正在加载">
              <Skeleton className="h-36 w-full rounded-group" />
              <Skeleton className="h-36 w-full rounded-group" />
            </View>
          ) : null}
          {venueItems && venueItems.length === 0 ? (
            <ScreenState
              message="在场馆主页点「关注场馆」，就能在这里看实时作息与直播。"
              actionLabel="浏览基地和动物园"
              onAction={() => router.push("/institutions")}
            />
          ) : null}
          {venueItems && venueItems.length > 0 ? (
            <View className="gap-3">
              {venueItems.map((inst) => (
                <FollowedVenueCard
                  key={inst.institutionId}
                  institution={inst}
                  mapItem={mapBySlug.get(inst.slug)}
                  now={now}
                />
              ))}
              <Text variant="footnote" className="px-1 text-muted-foreground">
                已关注场馆的新发布动态会在探索页「场馆动态」中优先展示。
              </Text>
            </View>
          ) : null}
        </>
      )}
    </Page>
  );
}
