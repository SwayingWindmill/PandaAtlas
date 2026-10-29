import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { type MapItem, mapItemLabel, pandaCountLabel } from "./model";

export function MapRows({ items, onOpen }: { items: MapItem[]; onOpen: (item: MapItem) => void }) {
  return (
    <View>
      {items.map((item, index) => (
        <Pressable
          key={item.id}
          onPress={() => onOpen(item)}
          role="button"
          accessibilityLabel={mapItemLabel(item)}
          className={cn(
            "flex-row items-center gap-3 border-t-hairline border-border py-3 active:bg-accent",
            index === items.length - 1 && "border-b-hairline",
          )}
        >
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="font-bold">{item.name}</Text>
            <View className="flex-row flex-wrap gap-x-3">
              {item.overseas && item.where ? <Text variant="muted">{item.where}</Text> : null}
              <Text variant="muted">{pandaCountLabel(item.residentCount)}</Text>
            </View>
            {item.residentNames ? <Text variant="muted">{item.residentNames}</Text> : null}
          </View>
          <Text className="text-muted-foreground">›</Text>
        </Pressable>
      ))}
    </View>
  );
}
