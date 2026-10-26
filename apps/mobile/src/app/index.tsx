import { Link } from "expo-router";
import { View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function HomeScreen() {
  return (
    <Page title="吱熊猫">
      <View className="gap-3 rounded-lg border-hairline border-border p-5">
        <Text variant="small" className="text-highlight-foreground">
          每日一猫
        </Text>
        <Text variant="h2">今天是哪只熊猫？</Text>
        <Text className="text-muted-foreground">所有人猜同一只。6 次机会，猜错一次多一条线索。</Text>
        <Link href="/daily" asChild>
          <Button className="self-start">
            <Text>开始猜</Text>
          </Button>
        </Link>
      </View>

      <View className="gap-3 rounded-lg border-hairline border-border p-5">
        <Text variant="small" className="text-highlight-foreground">
          家谱
        </Text>
        <Text variant="h2">美香一家</Text>
        <Link href={{ pathname: "/pandas/[slug]/family", params: { slug: "bao-bao" } }} asChild>
          <Button variant="secondary" className="self-start">
            <Text>看家谱</Text>
          </Button>
        </Link>
      </View>
    </Page>
  );
}
