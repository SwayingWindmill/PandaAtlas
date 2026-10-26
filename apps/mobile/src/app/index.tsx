import { Link } from "expo-router";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function HomeScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-5">
      <View className="gap-3 rounded-lg border-hairline border-border p-5">
        <Text variant="small" className="text-highlight-foreground">
          每日一猫
        </Text>
        <Text variant="h2">今天是哪只熊猫？</Text>
        <Text className="text-muted-foreground">每天所有人猜同一只熊猫，猜错一次多揭开一条线索。</Text>
        <Link href="/daily" asChild>
          <Button className="self-start">
            <Text>猜今天的熊猫</Text>
          </Button>
        </Link>
      </View>

      <View className="gap-3 rounded-lg border-hairline border-border p-5">
        <Text variant="small" className="text-highlight-foreground">
          家谱
        </Text>
        <Text variant="h2">美香一家</Text>
        <Text className="text-muted-foreground">从宝宝开始，看她的父母、兄弟姐妹和孩子。</Text>
        <Link href={{ pathname: "/pandas/[slug]/family", params: { slug: "bao-bao" } }} asChild>
          <Button variant="secondary" className="self-start">
            <Text>看家谱</Text>
          </Button>
        </Link>
      </View>
    </ScrollView>
  );
}
