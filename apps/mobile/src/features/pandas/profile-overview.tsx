import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { Chevron, ListCell, ListSection } from "@/components/grouped-list";
import { CalendarHeart } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { Text } from "@/components/ui/text";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { learningText, visibleTips } from "@/features/learning/catalog";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { useMilestonesOn } from "@/features/milestones/prefs";
import { sourceLine } from "@/features/on-this-day/memory-group";
import { DECEASED_POLICY, isCubDay } from "@/features/on-this-day/on-this-day";
import type { Profile } from "@/features/pandas/profile";
import { VenueLiveCard } from "@/features/viewing/venue-live-card";

export function openPandaCorrection(slug: string) {
  router.push({ pathname: "/pandas/[slug]/correct", params: { slug } });
}

export function Memories({ profile }: { profile: Profile }) {
  const sources = new Map(profile.sources.map((source) => [source.id, source]));
  // 满月 and 满百天 are 里程碑, and go with its switch.
  const milestonesOn = useMilestonesOn();
  const memories = profile.memories.filter((memory) => milestonesOn || !isCubDay(memory));
  if (memories.length === 0) return null;
  return (
    <ListSection title={profile.deceased ? DECEASED_POLICY.heading : "那年今天"} titleIcon={CalendarHeart}>
      {memories.map((memory, index) => (
        <ListCell
          key={memory.key}
          label={memory.text}
          detail={sourceLine(memory, memory.sourceIds.map((id) => sources.get(id)).find(Boolean)) ?? undefined}
          lines={3}
          last={index === memories.length - 1}
        />
      ))}
    </ListSection>
  );
}

/** Shows the live venue clock, active bar, and live cam link for the panda's current institution. */
export function PandaVenueLive({ profile }: { profile: Profile }) {
  const visit = !profile.deceased ? profile.visit : null;
  const { data: institutions } = useQuery({
    ...institutionListQueryOptions(),
    enabled: Boolean(visit),
  });
  if (!visit) return null;

  const inst = institutions?.find((item) => item.slug === visit.institutionSlug);
  const venueName = inst?.nameZh ?? inst?.nameEn ?? visit.place;
  return (
    <VenueLiveCard
      variant="panda"
      slug={visit.institutionSlug}
      venueName={venueName}
      apiLiveCamUrl={inst?.profile?.liveCamUrl ?? null}
      onOpenVenue={() => router.push({ pathname: "/institutions/[slug]", params: { slug: visit.institutionSlug } })}
    />
  );
}

/** Direct card linking to a panda's published face recognition guide when one exists. */
export function PandaFaceGuideCard({ slug, pandaId }: { slug: string; pandaId: string }) {
  const { state } = useLearningCatalog();
  if (state.status !== "ready") return null;

  const guide = state.catalog.faceGuides.find((item) => item.pandaSlug === slug);
  if (!guide) return null;

  const title = learningText(guide.title);
  const tips = visibleTips(guide.tips).slice(0, 3);
  return (
    <Pressable
      role="link"
      accessibilityLabel={`认脸指南，${title}`}
      onPress={() => router.push({ pathname: "/learn/faces/[slug]", params: { slug: guide.slug } })}
      className="flex-row items-center gap-3 rounded-group bg-card px-4 py-3 active:opacity-75"
      style={{ borderCurve: "continuous" }}
    >
      <PandaThumb pandaId={pandaId} name={title} size={44} shape="round" />
      <View className="min-w-0 flex-1 gap-1.5">
        <Text variant="headline" numberOfLines={2}>
          {`认脸指南　${title}`}
        </Text>
        {tips.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {tips.map((tip) => (
              <View key={tip.key} className="rounded-pill bg-secondary px-2.5 py-0.5">
                <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                  {learningText(tip.label)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Chevron />
    </Pressable>
  );
}
