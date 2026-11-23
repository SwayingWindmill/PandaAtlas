import { Linking, Pressable, View } from "react-native";

import { ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Globe, Pause, Play } from "@/components/icons";
import { Page } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";
import { PANDA_SOUND_CLIPS, VOCALIZATION_GUIDE } from "@/features/sounds/catalog";
import { useSoundPlayer } from "@/features/sounds/use-sound-player";
import { HAIRLINE } from "@/lib/surface";

export default function SoundsScreen() {
  const player = useSoundPlayer("panda-twittering");

  return (
    <Page title="声音图鉴">
      <View className="gap-row">
        <SectionHeader title="实听原声" count={`${PANDA_SOUND_CLIPS.length} 条`} />
        <View className="gap-row">
          {PANDA_SOUND_CLIPS.map((clip) => {
            const active = player.activeId === clip.id;
            const playing = active && player.isPlaying;
            const bars = clip.waveform.slice(0, 14);
            const activeBars = active
              ? Math.max(0, Math.round(bars.length * (playing ? Math.max(player.progress, 0.2) : 0.3)))
              : 0;
            return (
              <View
                key={clip.id}
                className="gap-stack-tight rounded-group bg-card p-inset"
                style={{ borderCurve: "continuous" }}
              >
                <View className="flex-row items-center gap-row">
                  <Pressable
                    role="button"
                    accessibilityLabel={playing ? `暂停${clip.title}` : `播放${clip.title}`}
                    accessibilityState={{ selected: playing }}
                    hitSlop={10}
                    onPress={() => player.toggle(clip.id)}
                    className="min-h-11 min-w-11 items-center justify-center active:opacity-60"
                  >
                    <Icon icon={playing ? Pause : Play} size="title3" tone="tint" strokeWidth={2.1} />
                  </Pressable>
                  <View className="min-w-0 flex-1 gap-hair-gap">
                    <Text variant="headline" numberOfLines={1}>
                      {clip.title}
                    </Text>
                    <Text variant="footnote" className="text-muted-foreground tabular-nums">
                      {`${clip.license}　${clip.durationLabel}`}
                    </Text>
                  </View>
                  <View className="flex-row items-center" style={{ gap: 2.5, height: 22 }} aria-hidden>
                    {bars.map((h, idx) => (
                      <View
                        key={idx}
                        className={idx < activeBars ? "rounded-full bg-primary" : "rounded-full bg-border"}
                        style={{ width: 2.5, height: Math.max(5, Math.round(h * 0.85)) }}
                      />
                    ))}
                  </View>
                </View>
                <Text variant="subheadline" className="text-muted-foreground">
                  {clip.description}
                </Text>
                <View className="flex-row items-center justify-between gap-row pt-hair-gap">
                  <Text variant="footnote" className="min-w-0 flex-1 text-muted-foreground" numberOfLines={1}>
                    {`署名：${clip.artist}`}
                  </Text>
                  <Pressable
                    role="link"
                    accessibilityLabel={`查看${clip.title}原始授权页`}
                    onPress={() => void Linking.openURL(clip.pageUrl)}
                    className="min-h-11 flex-row items-center gap-1 px-1 active:opacity-60"
                  >
                    <Icon icon={Globe} size="footnote" tone="tint" />
                    <Text variant="footnote" className="font-semibold text-primary">
                      原文件出处
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <ListSection title="大熊猫如何发声" footer="仅展示经过验证的公有领域与知识共享原声；更多叫声将在取得授权后补充。">
        {VOCALIZATION_GUIDE.map((entry, index) => {
          const linked = entry.linkedClipId;
          const playingThis = linked !== undefined && player.activeId === linked && player.isPlaying;
          return (
            <View key={entry.id}>
              <View className="gap-hair-gap px-inset py-row">
                <View className="flex-row items-center justify-between gap-row">
                  <Text variant="headline" className="min-w-0 flex-1">
                    {entry.name}
                  </Text>
                  {linked ? (
                    <Pressable
                      role="button"
                      accessibilityLabel={playingThis ? `暂停${entry.name}示例` : `试听${entry.name}示例`}
                      hitSlop={8}
                      onPress={() => player.toggle(linked)}
                      className="flex-row items-center justify-center gap-1 rounded-pill bg-highlight-soft px-3 active:opacity-70"
                      style={{ height: 28 }}
                    >
                      <Icon icon={playingThis ? Pause : Play} size="footnote" tone="tint" />
                      <Text variant="footnote" className="font-semibold text-primary">
                        {playingThis ? "暂停" : "试听"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text variant="footnote" className="font-semibold text-primary">
                  {entry.context}
                </Text>
                <Text variant="subheadline" className="text-muted-foreground">
                  {entry.description}
                </Text>
              </View>
              {index < VOCALIZATION_GUIDE.length - 1 ? (
                <View className="ml-inset bg-border" style={{ height: HAIRLINE }} />
              ) : null}
            </View>
          );
        })}
      </ListSection>
    </Page>
  );
}
