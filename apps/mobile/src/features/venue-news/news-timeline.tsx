import { Linking, Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { House } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { SourceBadge } from "@/components/source-badge";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import type { PandaListItem } from "@/features/pandas/pandas";
import { cn } from "@/lib/utils";

import { daysUntil, dotDate, sourceHost } from "./format";
import type { VenueNewsItem } from "./venue-news";

const PHOTO = 44;
const DOT = 9;
const NOW_DOT = 12;
const NOW_RING = 4;

/**
 * 场馆动态 as one timeline card (v4 `07b-venue-news`): a rail with a dot per notice, the newest tinted; the
 * date, the venue and the notice's own headline; a countdown on one still to come; the photo of the first
 * panda it names. A row opens the original. The publishers follow under the card as badges.
 */
export function NewsTimeline({
  items,
  venues,
  pandas,
  showVenue = true,
}: {
  items: VenueNewsItem[];
  /** Institution slug → name. */
  venues: ReadonlyMap<string, string>;
  /** Panda slug → panda, for the photo. */
  pandas: ReadonlyMap<string, PandaListItem>;
  showVenue?: boolean;
}) {
  const { rail, column } = component.timeline;
  const hosts = [...new Set(items.map((item) => sourceHost(item.sourceUrl)))];
  return (
    <View className="gap-row">
      <View className="rounded-group bg-card px-inset py-inset" style={{ borderCurve: "continuous" }}>
        {items.map((item, index) => {
          const first = index === 0;
          const last = index === items.length - 1;
          const ahead = daysUntil(item.publishedOn);
          const venue = venues.get(item.institutionSlug) ?? item.institutionSlug;
          const panda = item.pandaSlugs.map((slug) => pandas.get(slug)).find(Boolean);
          const countdown = ahead > 0 ? `${ahead} 天后` : ahead === 0 ? "今天" : null;
          return (
            <Pressable
              key={item.id}
              onPress={() => void Linking.openURL(item.sourceUrl)}
              role="link"
              accessibilityLabel={[dotDate(item.publishedOn), countdown, showVenue ? venue : null, item.headline].filter(Boolean).join("，")}
              accessibilityHint={`打开 ${sourceHost(item.sourceUrl)} 的原文`}
              className="flex-row gap-row active:opacity-70"
            >
              <View className="items-center" style={{ width: column }}>
                <View className={cn("bg-border", first && "opacity-0")} style={{ width: rail, height: 6 }} />
                <View
                  className={cn("rounded-pill", first ? "border-highlight-soft bg-graphic" : "bg-tertiary-foreground")}
                  style={
                    first
                      ? { width: NOW_DOT + NOW_RING * 2, height: NOW_DOT + NOW_RING * 2, borderWidth: NOW_RING }
                      : { width: DOT, height: DOT, marginVertical: (NOW_DOT - DOT) / 2 + NOW_RING }
                  }
                />
                <View className={cn("flex-1 bg-border", last && "opacity-0")} style={{ width: rail }} />
              </View>
              <View className={cn("min-w-0 flex-1 flex-row items-start gap-row", !last && "pb-stack")}>
                <View className="min-w-0 flex-1 gap-hair-gap">
                  <View className="flex-row flex-wrap items-center gap-x-1.5">
                    <Text variant="footnote" className={cn("font-semibold tabular-nums", first ? "text-primary" : "text-muted-foreground")}>
                      {dotDate(item.publishedOn)}
                    </Text>
                    {showVenue ? (
                      <>
                        <Icon icon={House} size="footnote" />
                        <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                          {venue}
                        </Text>
                      </>
                    ) : null}
                  </View>
                  <Text variant="subheadline" className="font-semibold">
                    {item.headline}
                  </Text>
                </View>
                {countdown ? (
                  <Text variant="subheadline" className="pt-5 font-semibold text-primary tabular-nums">
                    {countdown}
                  </Text>
                ) : panda ? (
                  <View className="pt-hair-gap">
                    <PandaThumb pandaId={panda.id} name={panda.name} size={PHOTO} shape="tile" />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {hosts.length > 0 ? (
        <View className="flex-row flex-wrap gap-x-row gap-y-hair-gap px-inset">
          {hosts.map((host) => (
            <SourceBadge key={host} name={host} official accessibilityLabel={`官方出处 ${host}`} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
