import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection } from "@/components/grouped-list";
import { MapPin } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_ENTER } from "@/design/motion";
import { loadMilestones } from "@/features/milestones/load";
import type { PersonalMilestone } from "@/features/milestones/milestones";
import { setMilestonePrefs, useMilestonePrefs } from "@/features/milestones/prefs";
import { MilestoneSettings } from "@/features/milestones/settings-section";
import { longDate } from "@/features/pandas/profile";
import { useSession } from "@/features/session/session";
import { tapHaptic } from "@/lib/haptics";

const THUMB = 40;
/** A milestone's title is the whole point of its row: let it wrap rather than cut off in a narrow window. */
const TITLE_LINES = 3;

function open(milestone: PersonalMilestone) {
  const { subject } = milestone;
  if (!subject.slug) return;
  if (subject.kind === "panda") router.push({ pathname: "/pandas/[slug]", params: { slug: subject.slug } });
  else router.push({ pathname: "/places/[slug]", params: { slug: subject.slug } });
}

/**
 * 里程碑: the days the fan's own counts reached a round number, as a birder keeps the day of a 100th species.
 * Only what the fan recorded, newest first; no goal, no streak, no one else's number. It can be turned off.
 */
export default function MilestonesScreen() {
  const { state } = useSession();
  const prefs = useMilestonePrefs();
  const [milestones, setMilestones] = useState<PersonalMilestone[] | null>(null);
  const [failed, setFailed] = useState(false);
  const signedIn = state.status === "signedIn";

  const load = useCallback(() => {
    if (!signedIn) return;
    setFailed(false);
    loadMilestones()
      .then(setMilestones)
      .catch(() => setFailed(true));
  }, [signedIn]);
  // Read again on return, so a panda just marked 见过 counts at once.
  useFocusEffect(load);

  if (!prefs || state.status === "loading") {
    return (
      <Page title="里程碑">
        <MilestonesSkeleton />
      </Page>
    );
  }
  if (prefs.off) {
    return (
      <Page title="里程碑">
        <ScreenState
          message="里程碑已关闭，图鉴、那年今天和时间线里也不再标出。"
          actionLabel="打开里程碑"
          onAction={() => {
            tapHaptic();
            setMilestonePrefs({ off: false });
          }}
        />
      </Page>
    );
  }
  if (!signedIn) {
    return (
      <Page title="里程碑">
        <ScreenState
          message="登录后，你认出、见过的熊猫和去过的地方，数到整数时会记在这里。"
          actionLabel="登录"
          onAction={() => router.push("/sign-in")}
        />
      </Page>
    );
  }
  if (!milestones) {
    return (
      <Page title="里程碑">{failed ? <LoadFailed message="里程碑暂时打不开。" onRetry={load} /> : <MilestonesSkeleton />}</Page>
    );
  }

  const pandas = milestones.filter((milestone) => milestone.kind === "panda");
  const places = milestones.filter((milestone) => milestone.kind === "visit");

  return (
    <Page title="里程碑">
      <Animated.View entering={PAGE_ENTER} className="gap-section">
        {milestones.length === 0 ? (
          <ScreenState message="还没有里程碑。认出或见过第一只熊猫，就是第一个。" />
        ) : null}
        {pandas.length > 0 ? (
          <ListSection title="熊猫">
            {pandas.map((milestone, index) => (
              <ListCell
                key={milestone.key}
                leading={<PandaThumb pandaId={milestone.subject.id} name={milestone.subject.name} size={THUMB} />}
                label={milestone.title}
                lines={TITLE_LINES}
                detail={`${milestone.subject.name} · ${longDate(milestone.date)}`}
                onPress={milestone.subject.slug ? () => open(milestone) : undefined}
                last={index === pandas.length - 1}
              />
            ))}
          </ListSection>
        ) : null}
        {places.length > 0 ? (
          <ListSection title="地方">
            {places.map((milestone, index) => (
              <ListCell
                key={milestone.key}
                icon={MapPin}
                label={milestone.title}
                lines={TITLE_LINES}
                detail={longDate(milestone.date)}
                onPress={milestone.subject.slug ? () => open(milestone) : undefined}
                last={index === places.length - 1}
              />
            ))}
          </ListSection>
        ) : null}
        <MilestoneSettings />
      </Animated.View>
    </Page>
  );
}

/** One group of rows, laid out as the loaded page is. */
function MilestonesSkeleton() {
  return (
    <View className="gap-1.5" accessibilityLabel="正在加载里程碑">
      <Skeleton className="mx-4 h-4 w-16 rounded-control" />
      <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
        {[0, 1, 2].map((row) => (
          <View key={row} className="flex-row items-center gap-3 px-4 py-3">
            <Skeleton className="rounded-full" style={{ width: THUMB, height: THUMB }} />
            <View className="flex-1 gap-2">
              <Skeleton className="h-5 w-1/2 rounded-control" />
              <Skeleton className="h-3.5 w-2/3 rounded-control" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
