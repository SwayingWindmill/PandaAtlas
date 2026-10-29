import { Link } from "expo-router";
import { View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { FollowedChanges } from "@/features/today/followed-changes";
import { FollowedStrip } from "@/features/today/followed-strip";
import { TodayBirthdays } from "@/features/today/today-birthdays";

export default function TodayScreen() {
  return (
    <Page title="今天" back={false}>
      <FollowedStrip />
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
      <TodayBirthdays />
      <FollowedChanges />
      <View className="gap-3 rounded-lg border-hairline border-border p-5">
        <Text variant="small" className="text-highlight-foreground">
          猜熊猫
        </Text>
        <Text variant="h2">看照片认熊猫</Text>
        <Link href="/guess" asChild>
          <Button variant="secondary" className="self-start">
            <Text>来一题</Text>
          </Button>
        </Link>
      </View>
      <View className="gap-3 rounded-lg border-hairline border-border p-5">
        <Text variant="small" className="text-highlight-foreground">
          科普
        </Text>
        <Text variant="h2">认识大熊猫</Text>
        <Link href="/learn" asChild>
          <Button variant="secondary" className="self-start">
            <Text>去看看</Text>
          </Button>
        </Link>
      </View>
      <View className="gap-3 rounded-lg border-hairline border-border p-5">
        <Text variant="small" className="text-highlight-foreground">
          熊猫日历
        </Text>
        <Text variant="h2">这个月谁过生日</Text>
        <Link href="/calendar" asChild>
          <Button variant="secondary" className="self-start">
            <Text>看日历</Text>
          </Button>
        </Link>
      </View>
    </Page>
  );
}
