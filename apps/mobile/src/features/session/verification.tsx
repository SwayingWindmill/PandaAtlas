import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { type Enrollment, enrollAuthenticator, verifyAuthenticator } from "@/features/session/mfa";

const CODE_LENGTH = 6;

function CodeForm({ factorId, onVerified }: { factorId: string; onVerified: () => void }) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "wrong" | "failed">("idle");

  async function verify() {
    setStatus("verifying");
    try {
      if (await verifyAuthenticator(factorId, code)) {
        onVerified();
        return;
      }
      setStatus("wrong");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <View className="gap-2">
      <TextInput
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        placeholder="6 位验证码"
        placeholderTextColor={muted}
        accessibilityLabel="认证器验证码"
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        className="h-12 rounded-full border-hairline border-input px-5 text-base text-foreground"
      />
      <Button
        className="self-start"
        onPress={() => void verify()}
        disabled={code.length !== CODE_LENGTH || status === "verifying"}
      >
        <Text>验证</Text>
      </Button>
      {status === "wrong" ? (
        <Text className="text-destructive">验证码不对或已过期，请看认证器上最新的一组。</Text>
      ) : null}
      {status === "failed" ? <Text className="text-destructive">暂时没能验证，请稍后再试。</Text> : null}
    </View>
  );
}

/**
 * Asks for the authenticator code before a sensitive action, setting the authenticator up first when the fan has
 * none. `factorId` is the fan's verified authenticator, or null.
 */
export function Verification({ factorId, onVerified }: { factorId: string | null; onVerified: () => void }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "failed">("idle");

  async function start() {
    setStatus("starting");
    try {
      setEnrollment(await enrollAuthenticator());
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }

  if (factorId) {
    return (
      <View className="gap-3 rounded-lg border-hairline border-border p-4">
        <Text className="font-bold">先验证是你本人</Text>
        <Text className="text-muted-foreground">输入认证器 App 上显示的验证码。</Text>
        <CodeForm factorId={factorId} onVerified={onVerified} />
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-lg border-hairline border-border p-4">
      <Text className="font-bold">设置两步验证</Text>
      <Text className="text-muted-foreground">
        导出数据和注销账号前，需要用认证器 App（如 Google Authenticator、Microsoft Authenticator）确认是你本人。
      </Text>
      {enrollment ? (
        <View className="gap-3">
          <Image
            source={enrollment.qrCode}
            style={{ width: 180, height: 180 }}
            contentFit="contain"
            accessibilityLabel="两步验证二维码"
          />
          <Text variant="muted">也可以在认证器里手动输入密钥：</Text>
          <Text selectable className="font-bold" accessibilityLabel="两步验证密钥">
            {enrollment.secret}
          </Text>
          <Button variant="secondary" className="self-start" onPress={() => void Linking.openURL(enrollment.uri)}>
            <Text>在认证器 App 中添加</Text>
          </Button>
          <Text className="text-muted-foreground">添加后，输入认证器上的验证码完成设置。</Text>
          <CodeForm factorId={enrollment.factorId} onVerified={onVerified} />
        </View>
      ) : (
        <Button className="self-start" onPress={() => void start()} disabled={status === "starting"}>
          <Text>开始设置</Text>
        </Button>
      )}
      {status === "failed" ? <Text className="text-destructive">暂时没能开始设置，请稍后再试。</Text> : null}
    </View>
  );
}
