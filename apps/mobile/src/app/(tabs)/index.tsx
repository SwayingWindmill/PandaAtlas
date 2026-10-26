import { Link } from "expo-router";
import { View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function TodayScreen() {
  return (
    <Page title="今天" back={false}>
      <View className="gap-3 rounded-lg border-hairline border-border p-5">
        <Text variant="small" className="text-highlight-foreground">
          每日一猫
        </Text>
        <Text variant="h2">今天是哪只熊猫？</Text>
        <Link href="/daily" asChild>
          <Button className="self-start">
            <Text>开始猜</Text>
          </Button>
        </Link>
      </View>
    </Page>
  );
}
