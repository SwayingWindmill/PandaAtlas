import { Image } from "expo-image";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { usePandaCover } from "@/lib/covers";

function Frame({ aspect, children }: { aspect: "4/3" | "4/5"; children: ReactNode }) {
  return (
    <View className={aspect === "4/3" ? "aspect-[4/3] overflow-hidden rounded-lg" : "aspect-[4/5] overflow-hidden rounded-lg"}>
      {children}
    </View>
  );
}

function Empty({ aspect }: { aspect: "4/3" | "4/5" }) {
  return (
    <Frame aspect={aspect}>
      <View className="flex-1 items-center justify-center bg-muted">
        <Text className="text-muted-foreground">暂无照片</Text>
      </View>
    </Frame>
  );
}

function Cover({ pandaId, label, aspect }: { pandaId: string; label: string; aspect: "4/3" | "4/5" }) {
  const photo = usePandaCover(pandaId);
  if (!photo) return <Empty aspect={aspect} />;
  return (
    <Frame aspect={aspect}>
      <Image source={photo} style={{ width: "100%", height: "100%" }} contentFit="cover" accessibilityLabel={label} />
    </Frame>
  );
}

/** A published panda's cover, or 暂无照片 when this release has none. */
export function PandaPhoto({ pandaId, label, aspect }: { pandaId: string | null; label: string; aspect: "4/3" | "4/5" }) {
  if (!pandaId) return <Empty aspect={aspect} />;
  return <Cover pandaId={pandaId} label={label} aspect={aspect} />;
}
