import { Icon } from "@/components/icon";
import { UserRound } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";

import { initial } from "./profile";

/**
 * The fan's avatar: the first character of their name on the tinted fill, as Contacts draws a
 * monogram. With no name (signed out) it is the person glyph on the plain fill.
 */
export function ProfileAvatar({ name, size, quiet = false }: { name: string | null; size: number; quiet?: boolean }) {
  return (
    <Avatar
      alt={name ?? ""}
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: size / 2 }}
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
    >
      <AvatarFallback
        role="none"
        aria-label={undefined}
        className={name && !quiet ? "bg-highlight-soft" : "bg-secondary"}
      >
        {name ? (
          <Text
            variant={size >= 64 ? "display" : "title"}
            className={quiet ? "text-muted-foreground" : "text-primary"}
            role="none"
          >
            {initial(name)}
          </Text>
        ) : (
          <Icon icon={UserRound} size={Math.round(size * 0.45)} />
        )}
      </AvatarFallback>
    </Avatar>
  );
}
