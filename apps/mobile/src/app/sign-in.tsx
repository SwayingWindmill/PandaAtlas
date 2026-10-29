import { router } from "expo-router";
import { type ComponentProps, useState } from "react";
import { TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { SignInConsent } from "@/features/legal/legal-links";
import { SignInError, useSession } from "@/features/session/session";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field(props: ComponentProps<typeof TextInput>) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  return (
    <TextInput
      placeholderTextColor={muted}
      className="h-14 rounded-full border-hairline border-input px-5 text-base text-foreground"
      {...props}
    />
  );
}

export default function SignInScreen() {
  const { requestCode, verifyCode } = useSession();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof SignInError ? caught.message : "没能完成，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  const send = () =>
    run(async () => {
      const address = email.trim().toLowerCase();
      await requestCode(address);
      setSentTo(address);
      setCode("");
    });

  const verify = () =>
    run(async () => {
      await verifyCode(sentTo!, code);
      router.back();
    });

  return (
    <Page label="登录" title={sentTo ? "输入验证码" : "用邮箱登录"} keyboardShouldPersistTaps="handled">
      {sentTo ? (
        <View className="gap-3">
          <Text className="text-muted-foreground">{`验证码已发到 ${sentTo}`}</Text>
          <Field
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 位验证码"
            accessibilityLabel="验证码"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
          />
          <Button onPress={verify} disabled={busy || code.length !== 6}>
            <Text>登录</Text>
          </Button>
          <Button variant="secondary" onPress={() => setSentTo(null)} disabled={busy}>
            <Text>换个邮箱</Text>
          </Button>
        </View>
      ) : (
        <View className="gap-3">
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="邮箱"
            accessibilityLabel="邮箱"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <Button onPress={send} disabled={busy || !EMAIL.test(email.trim())}>
            <Text>获取验证码</Text>
          </Button>
        </View>
      )}
      {error ? <Text className="text-destructive">{error}</Text> : null}
      <SignInConsent />
    </Page>
  );
}
