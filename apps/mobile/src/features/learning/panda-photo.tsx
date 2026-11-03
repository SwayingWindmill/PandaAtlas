import { Image } from "expo-image";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { usePandaCover } from "@/lib/covers";

type Aspect = "4/3" | "4/5" | "1/1";

const ASPECT = { "4/3": 4 / 3, "4/5": 4 / 5, "1/1": 1 } as const;

function Frame({ aspect, rounded, children }: { aspect: Aspect; rounded: boolean; children: ReactNode }) {
  return (
    <View
      className={cn("overflow-hidden", rounded && "rounded-tile")}
      style={{ aspectRatio: ASPECT[aspect], borderCurve: "continuous" }}
    >
      {children}
    </View>
  );
}

function Empty({ aspect, rounded }: { aspect: Aspect; rounded: boolean }) {
  return (
    <Frame aspect={aspect} rounded={rounded}>
      <View className="flex-1 items-center justify-center bg-muted">
        <Text variant="footnote" className="text-muted-foreground">
          暂无照片
        </Text>
      </View>
    </Frame>
  );
}

function Cover({
  pandaId,
  label,
  aspect,
  rounded,
  decorative,
}: {
  pandaId: string;
  label: string;
  aspect: Aspect;
  rounded: boolean;
  decorative: boolean;
}) {
  const photo = usePandaCover(pandaId);
  if (!photo) return <Empty aspect={aspect} rounded={rounded} />;
  return (
    <Frame aspect={aspect} rounded={rounded}>
      <Image
        source={photo}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        accessible={!decorative}
        accessibilityLabel={decorative ? undefined : label}
      />
    </Frame>
  );
}

/** A published panda's cover, or 暂无照片 when this release has none. */
export function PandaPhoto({
  pandaId,
  label,
  aspect,
  rounded = true,
  decorative = false,
}: {
  pandaId: string | null;
  label: string;
  aspect: Aspect;
  rounded?: boolean;
  /** Inside a labeled button, the picture should not repeat the name. */
  decorative?: boolean;
}) {
  if (!pandaId) return <Empty aspect={aspect} rounded={rounded} />;
  return <Cover pandaId={pandaId} label={label} aspect={aspect} rounded={rounded} decorative={decorative} />;
}
