import { Pressable, ScrollView, View } from "react-native";

import { Icon } from "@/components/icon";
import { Pause, Play } from "@/components/icons";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";

import { PANDA_SOUND_CLIPS } from "./catalog";
import { useSoundPlayer } from "./use-sound-player";

export function SoundStripSection() {
  const player = useSoundPlayer("panda-twittering");
  const activeClip = PANDA_SOUND_CLIPS.find((clip) => clip.id === player.activeId) ?? PANDA_SOUND_CLIPS[0]!;
  const activeBars = player.isPlaying
    ? Math.max(4, Math.round(activeClip.waveform.length * Math.max(player.progress, 0.25)))
    : 6;

  return (
    <View className="gap-stack-tight">
      <SectionHeader
        title="听熊猫"
        action={{ label: "声音图鉴", href: "/sounds" }}
      />
      <View className="gap-2.5 rounded-group bg-card px-3.5 py-3" style={{ borderCurve: "continuous" }}>
        <View className="flex-row items-center gap-3">
          <Pressable
            role="button"
            accessibilityLabel={player.isPlaying ? `暂停${activeClip.title}` : `播放${activeClip.title}`}
            hitSlop={10}
            onPress={() => player.toggle(activeClip.id)}
            className="min-h-11 min-w-9 items-center justify-center active:opacity-60"
          >
            <Icon icon={player.isPlaying ? Pause : Play} size={22} tone="tint" strokeWidth={2.2} />
          </Pressable>

          <View className="min-w-0 flex-1 gap-hair-gap">
            <Text variant="headline" numberOfLines={1}>
              {activeClip.title}
            </Text>
            <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
              {`${activeClip.sceneLabel}　${activeClip.durationLabel}`}
            </Text>
          </View>

          <View className="flex-row items-center" style={{ gap: 2.5, height: 24 }} aria-hidden>
            {activeClip.waveform.map((height, index) => (
              <View
                key={index}
                className={index < activeBars ? "rounded-full bg-primary" : "rounded-full bg-border"}
                style={{ width: 2.5, height }}
              />
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PANDA_SOUND_CLIPS.map((clip) => {
            const selected = clip.id === activeClip.id;
            return (
              <Pressable
                key={clip.id}
                role="button"
                accessibilityLabel={`${clip.shortLabel}，${clip.durationLabel}`}
                accessibilityState={{ selected }}
                hitSlop={8}
                onPress={() => player.selectClip(clip.id, true)}
                className={
                  selected
                    ? "justify-center rounded-pill bg-highlight-soft px-3 active:opacity-75"
                    : "justify-center rounded-pill bg-background px-3 active:opacity-75"
                }
                style={{ height: 28, borderCurve: "continuous" }}
              >
                <Text
                  variant="footnote"
                  className={selected ? "font-semibold text-primary tabular-nums" : "font-medium text-muted-foreground tabular-nums"}
                  numberOfLines={1}
                >
                  {`${clip.shortLabel} ${clip.durationLabel}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
