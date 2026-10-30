import { TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { Search } from "@/components/icons";

/** The round search field of 找熊猫, the 查关系 picker, 每日一猫 and the welcome picker. */
export function SearchField({
  value,
  onChange,
  label = "搜索熊猫",
  placeholder = "名字或基地",
  autoFocus,
  editable,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** What the empty field suggests typing; 找熊猫 searches names and bases. */
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
}) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  return (
    <View
      // min-h, not h: at large text the line is taller than 44pt and a fixed height pushed the glyph out.
      className="min-h-11 flex-row items-center gap-2 rounded-control bg-card px-3"
      style={{ borderCurve: "continuous" }}
    >
      <Icon icon={Search} size="subhead" strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={muted}
        accessibilityLabel={label}
        autoCorrect={false}
        autoFocus={autoFocus}
        editable={editable}
        clearButtonMode="while-editing"
        returnKeyType="search"
        className="min-w-0 flex-1 self-stretch text-body text-foreground"
      />
    </View>
  );
}
