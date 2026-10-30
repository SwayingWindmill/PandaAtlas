import { TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { Search } from "@/components/icons";

/** The round search field of 找熊猫 and the 查关系 picker. */
export function SearchField({
  value,
  onChange,
  label = "搜索熊猫",
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  autoFocus?: boolean;
}) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  return (
    <View
      className="h-11 flex-row items-center gap-2 rounded-control bg-card px-3"
      style={{ borderCurve: "continuous" }}
    >
      <Icon icon={Search} size="subhead" strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="名字或基地"
        placeholderTextColor={muted}
        accessibilityLabel={label}
        autoCorrect={false}
        autoFocus={autoFocus}
        clearButtonMode="while-editing"
        returnKeyType="search"
        className="h-full flex-1 text-body text-foreground"
      />
    </View>
  );
}
