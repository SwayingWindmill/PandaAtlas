import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { localToday } from "@/features/engagement/seen";
import { SignInConsent } from "@/features/legal/legal-links";
import { rejectedCodeMessage, secondsUntilResend } from "@/features/session/otp";
import { SignInError, useSession } from "@/features/session/session";
import { type StoryPhoto, useStoryPhotos } from "@/features/today/story-photos";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FACE = 72;
/** Each face overlaps the one before by a third, ringed in the page background so they read as three. */
const OVERLAP = -FACE / 3;

/** Three of today's pandas, from the curated covers, as a sign-in sheet shows who is waiting. */
function Faces({ photos }: { photos: StoryPhoto[] }) {
  if (photos.length === 0) return <View style={{ height: FACE }} />;
  return (
    <View className="flex-row justify-center" accessible={false} importantForAccessibility="no-hide-descendants">
      {photos.map((photo, index) => (
        <View
          key={photo.pandaId}
          className="overflow-hidden rounded-full border-4 border-background bg-secondary"
          style={{ width: FACE + 8, height: FACE + 8, marginLeft: index === 0 ? 0 : OVERLAP, zIndex: photos.length - index }}
        >
          <PandaThumb pandaId={photo.pandaId} name="" photoUrl={photo.url} size={FACE} />
        </View>
      ))}
    </View>
  );
}

/** 重新发送验证码, after the minute Supabase makes a fan wait between two codes. */
function ResendButton({ sentAt, disabled, onPress }: { sentAt: number; disabled: boolean; onPress: () => void }) {
  const [now, setNow] = useState(Date.now);
  const left = secondsUntilResend(sentAt, now);
  useEffect(() => {
    if (left === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [left]);
  return (
    <Button variant="plain" onPress={onPress} disabled={disabled || left > 0}>
      <Text className="tabular-nums">{left > 0 ? `${left} 秒后可重新发送` : "重新发送验证码"}</Text>
    </Button>
  );
}

export default function SignInScreen() {
  const { requestCode, verifyCode } = useSession();
  const photos = useStoryPhotos(localToday(), 3);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      if (caught instanceof SignInError && caught.codeRejected) {
        setError(rejectedCodeMessage(sentAt, Date.now()));
        setCode("");
      } else {
        setError(caught instanceof SignInError ? caught.message : "没能完成，请稍后再试。");
      }
    } finally {
      setBusy(false);
    }
  }

  const send = () =>
    run(async () => {
      const address = email.trim().toLowerCase();
      await requestCode(address);
      setSentTo(address);
      setSentAt(Date.now());
      setCode("");
    });

  const resend = () =>
    run(async () => {
      await requestCode(sentTo!);
      setSentAt(Date.now());
      setCode("");
    });

  const verify = (entered: string) =>
    run(async () => {
      await verifyCode(sentTo!, entered);
      router.back();
    });

  function enterCode(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    // The sixth digit signs in, as the system's one-time-code autofill expects.
    if (digits.length === 6 && digits !== code && !busy) void verify(digits);
  }

  return (
    <Page title={sentTo ? "输入验证码" : "用邮箱登录"} keyboardShouldPersistTaps="handled">
      <View className="gap-stack">
        <Faces photos={photos} />
        <Text variant="subheadline" className="text-center text-muted-foreground">
          {sentTo
            ? `验证码已发到 ${sentTo}`
            : "登录后，关注的熊猫、图鉴、合集和去过的地点都存在你的账号里。"}
        </Text>
      </View>
      {sentTo ? (
        <Animated.View key="code" entering={PAGE_ENTER} className="gap-row">
          <TextField
            value={code}
            onChangeText={enterCode}
            placeholder="6 位验证码"
            accessibilityLabel="验证码"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            className="text-center tracking-widest tabular-nums"
            autoFocus
          />
          <Button onPress={() => void verify(code)} disabled={busy || code.length !== 6}>
            <Text>登录</Text>
          </Button>
          <ResendButton key={sentAt} sentAt={sentAt} disabled={busy} onPress={() => void resend()} />
          <Button variant="plain" onPress={() => setSentTo(null)} disabled={busy}>
            <Text>换个邮箱</Text>
          </Button>
        </Animated.View>
      ) : (
        <View className="gap-row">
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder="邮箱"
            accessibilityLabel="邮箱"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => {
              if (!busy && EMAIL.test(email.trim())) void send();
            }}
            autoFocus
          />
          <Button onPress={send} disabled={busy || !EMAIL.test(email.trim())}>
            <Text>获取验证码</Text>
          </Button>
        </View>
      )}
      {error ? (
        <Text variant="footnote" className="px-inset text-destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <SignInConsent />
    </Page>
  );
}
