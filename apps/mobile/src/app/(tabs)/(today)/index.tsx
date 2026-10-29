import { ListSection } from "@/components/grouped-list";
import { NavRow } from "@/components/nav-row";
import { Page } from "@/components/page";
import { FollowedChanges } from "@/features/today/followed-changes";
import { FollowedStrip } from "@/features/today/followed-strip";
import { TodayBirthdays } from "@/features/today/today-birthdays";

export default function TodayScreen() {
  return (
    <Page title="今天" back={false}>
      <FollowedStrip />
      <ListSection>
        <NavRow label="今天是哪只熊猫？" detail="每日一猫" href="/daily" />
        <NavRow label="看照片认熊猫" detail="猜熊猫" href="/guess" />
        <NavRow label="认识大熊猫" detail="科普" href="/learn" />
        <NavRow label="这个月谁过生日" detail="熊猫日历" href="/calendar" last />
      </ListSection>
      <TodayBirthdays />
      <FollowedChanges />
    </Page>
  );
}
