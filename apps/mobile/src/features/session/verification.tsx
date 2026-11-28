import { useState } from "react";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { ShieldCheck } from "@/components/icons";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { supabase } from "@/lib/supabase";

const CODE_LENGTH = 6;

function sendMessage(error: { status?: number; code?: string }): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    return "发送太频繁了，请稍后再试。";
  }
  return "暂时没能发送验证码，请稍后再试。";
}

function verifyMessage(error: { status?: number; code?: string }): string {
  if (error.code === "otp_expired") return "验证码不对或已过期，请检查或重新发送。";
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    return "操作太频繁了，请稍后再试。";
  }
  return "暂时没能验证，请稍后再试。";
}

/** The shield over the title, as iOS opens a security sheet: one bare glyph, no disc behind it. */
function Header({ title, children }: { title: string; children: string }) {
  return (
    <View className="items-center gap-stack-tight">
      <Icon icon={ShieldCheck} size={40} tone="tint" strokeWidth={1.5} />
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
 * Re-verifies the signed-in fan with a fresh email OTP before sensitive account actions.
 * Sending is strictly user-initiated on button press so mounting the card never mails a code on its own.
 */
export function Verification({ email, onVerified }: { email: string | null; onVerified: () => void }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!email || sending || verifying) return;
    setSending(true);
    setError(null);
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (sendError) {
        setError(sendMessage(sendError));
        return;
      }
      setSent(true);
      setCode("");
    } catch {
      setError("暂时没能发送验证码，请稍后再试。");
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    if (!email || code.length !== CODE_LENGTH || verifying || sending) return;
    setVerifying(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (verifyError) {
        setError(verifyMessage(verifyError));
        return;
      }
      onVerified();
    } catch {
      setError("暂时没能验证，请稍后再试。");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <View className="gap-stack rounded-card bg-card p-stack" style={{ borderCurve: "continuous" }}>
      <Header title="先验证是你本人">
        {sent && email
          ? `验证码已发到 ${email}，输入 6 位验证码后继续。`
          : email
            ? `导出数据和注销账号前，需要向 ${email} 发送验证码确认是你本人。`
            : "导出数据和注销账号前，需要先用登录邮箱完成一次验证码确认。"}
      </Header>
      {sent && email ? (
        <View className="gap-row">
          <TextField
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
            placeholder="6 位验证码"
            accessibilityLabel="邮箱验证码"
            inputMode="numeric"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            className="bg-secondary text-center tracking-widest tabular-nums"
          />
          <Button onPress={() => void verify()} disabled={code.length !== CODE_LENGTH || verifying || sending}>
            <Text>验证</Text>
          </Button>
          <Button variant="plain" onPress={() => void send()} disabled={sending || verifying}>
            <Text>重新发送验证码</Text>
          </Button>
        </View>
      ) : (
        <Button onPress={() => void send()} disabled={!email || sending}>
          <Text>发送验证码</Text>
        </Button>
      )}
      {error ? (
        <Text variant="footnote" className="text-center text-destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
