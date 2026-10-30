import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useState } from "react";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { ShieldCheck } from "@/components/icons";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { type Enrollment, enrollAuthenticator, verifyAuthenticator } from "@/features/session/mfa";

const CODE_LENGTH = 6;
const QR = 180;

function CodeForm({ factorId, onVerified }: { factorId: string; onVerified: () => void }) {
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
    <View className="gap-row">
      <TextField
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        placeholder="6 位验证码"
        accessibilityLabel="认证器验证码"
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        className="bg-secondary text-center tracking-widest tabular-nums"
      />
      <Button onPress={() => void verify()} disabled={code.length !== CODE_LENGTH || status === "verifying"}>
        <Text>验证</Text>
      </Button>
      {status === "wrong" ? (
        <Text variant="footnote" className="text-center text-destructive" accessibilityLiveRegion="polite">
          验证码不对或已过期，请看认证器上最新的一组。
        </Text>
      ) : null}
      {status === "failed" ? (
        <Text variant="footnote" className="text-center text-destructive" accessibilityLiveRegion="polite">
          暂时没能验证，请稍后再试。
        </Text>
      ) : null}
    </View>
  );
}

/** The shield over the title, as iOS opens a security sheet: one glyph, in the tinted fill. */
function Header({ title, children }: { title: string; children: string }) {
  return (
    <View className="items-center gap-stack-tight">
      <View className="size-14 items-center justify-center rounded-full bg-highlight-soft">
        <Icon icon={ShieldCheck} size="title3" tone="tint" />
      </View>
      <Text variant="title" className="text-center">
        {title}
      </Text>
      <Text variant="subheadline" className="text-center text-muted-foreground">
        {children}
      </Text>
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
      <View className="gap-stack rounded-card bg-card p-stack" style={{ borderCurve: "continuous" }}>
        <Header title="先验证是你本人">输入认证器 App 上显示的验证码。</Header>
        <CodeForm factorId={factorId} onVerified={onVerified} />
      </View>
    );
  }

  return (
    <View className="gap-stack rounded-card bg-card p-stack" style={{ borderCurve: "continuous" }}>
      <Header title="设置两步验证">
        导出数据和注销账号前，需要用认证器 App（如 Google Authenticator、Microsoft Authenticator）确认是你本人。
      </Header>
      {enrollment ? (
        <View className="gap-stack">
          {/* A QR code needs a light ground to scan, in dark mode too. */}
          <View className="items-center self-center rounded-tile bg-on-media p-row" style={{ borderCurve: "continuous" }}>
            <Image
              source={enrollment.qrCode}
              style={{ width: QR, height: QR }}
              contentFit="contain"
              accessibilityLabel="两步验证二维码"
            />
          </View>
          <View className="gap-1.5">
            <Text variant="footnote" className="text-muted-foreground">
              也可以在认证器里手动输入密钥：
            </Text>
            <View className="rounded-control bg-secondary px-inset py-row" style={{ borderCurve: "continuous" }}>
              <Text variant="body" selectable className="font-semibold tracking-wider" accessibilityLabel="两步验证密钥">
                {enrollment.secret}
              </Text>
            </View>
          </View>
          <Button variant="tinted" onPress={() => void Linking.openURL(enrollment.uri)}>
            <Text>在认证器 App 中添加</Text>
          </Button>
          <Text variant="subheadline" className="text-center text-muted-foreground">
            添加后，输入认证器上的验证码完成设置。
          </Text>
          <CodeForm factorId={enrollment.factorId} onVerified={onVerified} />
        </View>
      ) : (
        <Button onPress={() => void start()} disabled={status === "starting"}>
          <Text>开始设置</Text>
        </Button>
      )}
      {status === "failed" ? (
        <Text variant="footnote" className="text-center text-destructive" accessibilityLiveRegion="polite">
          暂时没能开始设置，请稍后再试。
        </Text>
      ) : null}
    </View>
  );
}
