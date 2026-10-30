import { View } from "react-native";

import { Icon } from "@/components/icon";
import { UserRound } from "@/components/icons";
import { Text } from "@/components/ui/text";

import { initial } from "./profile";

/**
 * The fan's avatar: the first character of their name on the tinted fill, as Contacts draws a
 * monogram. With no name (signed out) it is the person glyph on the plain fill.
 */
export function ProfileAvatar({ name, size }: { name: string | null; size: number }) {
  return (
    <View
      className={
        name
          ? "items-center justify-center rounded-full bg-highlight-soft"
          : "items-center justify-center rounded-full bg-secondary"
      }
      style={{ width: size, height: size }}
      accessible={false}
    >
      {name ? (
        <Text variant={size >= 64 ? "display" : "title"} className="text-primary" role="none">
          {initial(name)}
        </Text>
      ) : (
        <Icon icon={UserRound} size={Math.round(size * 0.45)} />
      )}
    </View>
  );
}
