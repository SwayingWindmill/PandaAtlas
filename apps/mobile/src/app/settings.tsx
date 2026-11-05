import { useQuery } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { Pressable } from "react-native";

import { Chevron, ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Database, FileText, Lock, Moon } from "@/components/icons";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { APPEARANCES, useAppearance } from "@/features/appearance/appearance";
import { BirthdaySwitch } from "@/features/birthdays/settings-section";
import { LegalRow } from "@/features/legal/legal-links";
import { MilestoneSwitch } from "@/features/milestones/settings-section";
import { OnThisDaySwitch } from "@/features/on-this-day/settings-section";
import { ProfileAvatar } from "@/features/profile/avatar";
import { displayName, useProfile } from "@/features/profile/profile";
import { useSession } from "@/features/session/session";
import { api } from "@/lib/api";

const AVATAR = 48;

/** The account as one row at the head of 设置, as Settings shows the Apple Account; it opens 账号与数据. */
function AccountRow({ name, href, hint }: { name: string | null; href: Href; hint: string }) {
  // At accessibility sizes the avatar sits above the name so the name keeps the full width.
  const stacked = useStacked();
  return (
    <ListSection>
      <Pressable
        role="link"
        accessibilityLabel={name ?? "登录"}
        accessibilityHint={hint}
        onPress={() => router.push(href)}
        className={`min-h-11 gap-row px-inset py-stack-tight active:bg-accent ${stacked ? "flex-col items-start" : "flex-row items-center"}`}
      >
        <ProfileAvatar name={name} size={AVATAR} quiet />
        <Text variant="headline" numberOfLines={2} className={stacked ? "self-stretch" : "min-w-0 flex-1"}>
          {name ?? "登录"}
        </Text>
        {stacked ? null : <Chevron />}
      </Pressable>
    </ListSection>
  );
}

function SignedInRow({ email }: { email: string | null }) {
  const { profile } = useProfile();
  if (!profile) return <Skeleton className="h-20 w-full rounded-group" accessibilityLabel="正在加载" />;
  const name = displayName(profile, email);
  return <AccountRow name={name} href="/account" hint="打开账号与数据" />;
}

/** The published data release, said at the foot of 设置. Nothing when the stats cannot be read. */
function DataVersion() {
  const { data } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => (await api.GET("/api/v2/stats")).data ?? null,
  });
  const version = data?.release.version;
  if (!version) return null;
  return (
    <Text variant="footnote" className="text-center tabular-nums text-muted-foreground">
      {`吱熊猫 · 数据版本 ${version}`}
    </Text>
  );
}

/** 设置: the account, 外观, the 提醒 switches, the source and legal pages, and 退出登录. */
export default function SettingsScreen() {
  const { state, signOut } = useSession();
  const [appearance] = useAppearance();
  const signedIn = state.status === "signedIn";
  return (
    <Page title="设置">
      {state.status === "loading" ? <Skeleton className="h-20 w-full rounded-group" accessibilityLabel="正在加载" /> : null}
      {signedIn ? <SignedInRow email={state.email} /> : null}
      {state.status === "signedOut" ? (
        <AccountRow name={null} href="/sign-in" hint="打开登录" />
      ) : null}
      {state.status === "unavailable" ? (
        <Text variant="subheadline" className="text-center text-muted-foreground">
          账号暂时不可用，请稍后再试。
        </Text>
      ) : null}
      <ListSection>
        <ListCell
          label="外观"
          glyph={Moon}
          meta={APPEARANCES.find((option) => option.value === appearance)?.label}
          href="/appearance"
          last
        />
      </ListSection>
      <ListSection title="提醒">
        <BirthdaySwitch separator />
        <OnThisDaySwitch separator />
        <MilestoneSwitch />
      </ListSection>
      <ListSection>
        <ListCell label="数据来源" glyph={Database} href="/about" />
        <LegalRow id="privacy" glyph={Lock} />
        <LegalRow id="terms" glyph={FileText} last />
      </ListSection>
      {signedIn || state.status === "unavailable" ? (
        <ListSection>
          <ListCell label="退出登录" tone="destructive" onPress={() => void signOut()} last />
        </ListSection>
      ) : null}
      <DataVersion />
    </Page>
  );
}
