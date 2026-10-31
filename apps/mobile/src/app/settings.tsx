import { router } from "expo-router";
import { View } from "react-native";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Info, ShieldCheck, FileText, Lock } from "@/components/icons";
import { Page } from "@/components/page";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type Appearance, useAppearance } from "@/features/appearance/appearance";
import { LegalRow } from "@/features/legal/legal-links";
import { OnThisDaySettings } from "@/features/on-this-day/settings-section";
import { ProfileAvatar } from "@/features/profile/avatar";
import { displayName, useProfile } from "@/features/profile/profile";
import { useSession } from "@/features/session/session";

const AVATAR = 80;

const APPEARANCES: readonly { value: Appearance; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

/** The account at the head of 设置, centred as the system Settings shows the Apple Account. */
function SignedInHeader({ email }: { email: string | null }) {
  const { profile } = useProfile();
  if (!profile) return <Skeleton className="h-36 w-full rounded-card" accessibilityLabel="正在加载" />;
  const name = displayName(profile, email);
  return (
    <View className="items-center gap-stack-tight">
      <ProfileAvatar name={name} size={AVATAR} />
      <View className="items-center gap-hair-gap">
        <Text variant="title" className="text-center" numberOfLines={1}>
          {name}
        </Text>
        {email && email !== name ? (
          <Text variant="footnote" className="text-center text-muted-foreground" numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SignedOutHeader() {
  return (
    <View className="items-center gap-row">
      <ProfileAvatar name={null} size={AVATAR} />
      <Text variant="subheadline" className="text-center text-muted-foreground">
        登录后，关注的熊猫和图鉴会保存在你的账号里。
      </Text>
      <Button className="self-stretch" onPress={() => router.push("/sign-in")}>
        <Text>登录</Text>
      </Button>
    </View>
  );
}

function AppearanceSection() {
  const [appearance, setAppearance] = useAppearance();
  return (
    <View className="gap-1.5">
      <Text variant="footnote" role="heading" className="px-inset text-muted-foreground">
        外观
      </Text>
      <Segmented value={appearance} options={APPEARANCES} onChange={setAppearance} accessibilityLabel="外观" />
    </View>
  );
}

/** 设置: the account, the look of the app, where the content comes from, the legal pages and 退出登录. */
export default function SettingsScreen() {
  const { state, signOut } = useSession();
  const signedIn = state.status === "signedIn";
  return (
    <Page title="设置">
      {state.status === "loading" ? (
        <Skeleton className="h-36 w-full rounded-card" accessibilityLabel="正在加载" />
      ) : null}
      {signedIn ? <SignedInHeader email={state.email} /> : null}
      {state.status === "signedOut" ? <SignedOutHeader /> : null}
      {state.status === "unavailable" ? (
        <Text variant="subheadline" className="text-center text-muted-foreground">
          账号暂时不可用，请稍后再试。
        </Text>
      ) : null}
      <AppearanceSection />
      <OnThisDaySettings />
      <ListSection>
        {signedIn ? <ListCell label="账号与数据" glyph={ShieldCheck} href="/account" /> : null}
        <ListCell label="内容和照片从哪来" glyph={Info} href="/about" last />
      </ListSection>
      <ListSection>
        <LegalRow id="terms" glyph={FileText} />
        <LegalRow id="privacy" glyph={Lock} last />
      </ListSection>
      {signedIn || state.status === "unavailable" ? (
        <ListSection>
          <ListCell label="退出登录" tone="destructive" onPress={() => void signOut()} last />
        </ListSection>
      ) : null}
    </Page>
  );
}
