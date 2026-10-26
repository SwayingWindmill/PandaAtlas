import { TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

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
    <View className="h-12 flex-row items-center gap-2.5 rounded-full border-hairline border-input px-4">
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth={2} strokeLinecap="round">
        <Circle cx={11} cy={11} r={7} />
        <Path d="m20 20-3.5-3.5" />
      </Svg>
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
        className="h-full flex-1 text-base text-foreground"
      />
    </View>
  );
}
