import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

/** A jade well for one icon. Jade stays on this small mark, not on buttons or backgrounds. */
export function IconWell({ icon: Icon, large = false }: { icon: LucideIcon; large?: boolean }) {
  const ink = useCSSVariable("--color-highlight-foreground");
  return (
    <View className={large ? "size-14 items-center justify-center rounded-xl bg-highlight-soft" : "size-11 items-center justify-center rounded-lg bg-highlight-soft"}>
      <Icon size={large ? 28 : 22} color={String(ink)} strokeWidth={2} />
    </View>
  );
}
