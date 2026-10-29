import { useLocalSearchParams } from "expo-router";
import { Ear, Eye, FlipHorizontal2, ScanFace } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { Card } from "@/components/card";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type FaceTipKey, entryBySlug, learningText, visibleTips } from "@/features/learning/catalog";
import { IconWell } from "@/features/learning/icon-well";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { LearningSources } from "@/features/learning/sources";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";
import { openPanda } from "@/features/pandas/panda-row";

const TIP_ICONS: Record<FaceTipKey, LucideIcon> = {
  shape: ScanFace,
  leftRight: FlipHorizontal2,
  eyePatches: Eye,
  ears: Ear,
};

function slugParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function FaceGuideScreen() {
  const slug = slugParam(useLocalSearchParams<{ slug: string }>().slug);
  const { state, reload } = useLearningCatalog();
  const { pandas } = useLearningPandas();
  if (state.status !== "ready") {
    return (
      <Page label="认脸指南" title="认脸指南">
        {state.status === "loading" ? <Skeleton className="h-80 w-full rounded-xl" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }
  const guide = entryBySlug(state.catalog.faceGuides, slug);
  if (!guide) return <Page label="认脸指南" title="没有这一篇" />;
  const panda = pandas?.find((item) => item.slug === guide.pandaSlug) ?? null;
  const title = learningText(guide.title);
  const tips = visibleTips(guide.tips);
  return (
    <Page label="认脸指南" title={title} contentContainerClassName="gap-6 px-5 pb-16">
      <Card>
        <PandaPhoto pandaId={panda?.id ?? null} label={title} aspect="4/5" rounded={false} />
      </Card>
      {tips.map((tip) => (
        <Card key={tip.key}>
          <View className="flex-row items-start gap-3 p-4">
            <IconWell icon={TIP_ICONS[tip.key]} />
            <View className="min-w-0 flex-1 gap-1">
              <Text variant="small" className="text-muted-foreground">
                {learningText(tip.label)}
              </Text>
              <Text className="leading-6">{learningText(tip.body)}</Text>
            </View>
          </View>
        </Card>
      ))}
      {panda ? (
        <Button onPress={() => openPanda(panda.slug)}>
          <Text>{`看${panda.name}的资料`}</Text>
        </Button>
      ) : null}
      <LearningSources sources={guide.sources} />
    </Page>
  );
}
