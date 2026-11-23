import { View, useWindowDimensions } from "react-native";

import { Page } from "@/components/page";
import { PhotoCard } from "@/features/discover/photo-card";
import { localToday } from "@/features/engagement/seen";
import { useStoryPhotos } from "@/features/today/story-photos";
import { pageColumn } from "@/lib/surface";

const GAP = 12;

const GAMES = [
  { id: "daily", title: "每日一猫", subtitle: "从外形和基地猜今天的主角", href: "/daily" },
  { id: "guess", title: "猜熊猫", subtitle: "看照片认出它是哪一只", href: "/guess" },
  { id: "faces", title: "认脸挑战", subtitle: "对比眼斑与脸颊细节", href: "/learn/challenge" },
  { id: "challenge", title: "月度挑战", subtitle: "每月主题收集点亮进度", href: "/challenge" },
] as const;

export default function PlayScreen() {
  const { width } = useWindowDimensions();
  const photos = useStoryPhotos(`play:${localToday()}`, GAMES.length);
  const column = pageColumn(width);
  const tile = Math.floor((column - GAP) / 2);

  return (
    <Page title="趣味挑战" label="通过写真识别、猜谜与每月收集，多一种方式认识每一只大熊猫。">
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {GAMES.map((game, index) => (
          <PhotoCard
            key={game.id}
            id={`play-${game.id}`}
            title={game.title}
            spoken={`${game.title}，${game.subtitle}`}
            photo={photos[index]}
            href={game.href}
            width={tile}
            ratio={1}
          />
        ))}
      </View>
    </Page>
  );
}
