import { useMemo } from "react";
import { Platform, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { primitive } from "@/design/tokens";
import { qrCode } from "@/features/pandas/qr";

const { black, white } = primitive.palette.gray;
/** Blank modules around the code; a scanner needs them, and they are the white edge on a dark card. */
const QUIET = 4;
// The DOM has no `accessible` attribute; aria-hidden covers web.
const HIDDEN = Platform.OS === "web" ? {} : { accessible: false };

/** A QR code of `value`, `size` points square including its white quiet zone. It stays black on white in dark mode. */
export function QrCode({ value, size = 72 }: { value: string; size?: number }) {
  const { size: modules, path } = useMemo(() => qrCode(value), [value]);
  const side = modules + QUIET * 2;
  return (
    // On web the <svg> would otherwise shrink as a flex child; the wrapper pins it to `size`.
    <View style={{ width: size, height: size, flexShrink: 0 }}>
      <Svg width={size} height={size} viewBox={`${-QUIET} ${-QUIET} ${side} ${side}`} aria-hidden {...HIDDEN}>
        <Rect x={-QUIET} y={-QUIET} width={side} height={side} fill={white} />
        <Path d={path} fill={black} />
      </Svg>
    </View>
  );
}
