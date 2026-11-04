import { type Href, router } from "expo-router";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import type { LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";

/**
 * A section's title on a photo-led page (今天, 图鉴, 我的), as App Store and Music head a shelf:
 * the name in `title`, an optional count in the secondary label after it, and an optional
 * trailing link in the tint ("全部", "看日历"), and an optional leading secondary glyph naming the
 * section's kind. Not for grouped lists; those take a footnote header.
 */
export function SectionHeader({
  title,
  count,
  action,
  icon,
}: {
  title: string;
  icon?: LucideIcon;
  /** "12 只": the size of what follows, regular weight. */
  count?: string;
  action?: { label: string; href: Href; accessibilityLabel?: string };
}) {
  return (
    <View className="min-h-11 flex-row items-end justify-between gap-row">
      {icon ? (
        <View className="pb-hair-gap">
          <Icon icon={icon} size="title3" />
        </View>
      ) : null}
      <Text variant="title" className="min-w-0 flex-1" numberOfLines={2}>
        {title}
        {count ? <Text variant="body" className="font-normal text-muted-foreground">{`　${count}`}</Text> : null}
      </Text>
      {action ? (
        <Pressable
          onPress={() => router.push(action.href)}
          role="link"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          hitSlop={8}
          className="min-h-11 justify-end active:opacity-60"
        >
          <Text variant="body" className="text-primary">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
