import * as WebBrowser from "expo-web-browser";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { type LegalDocumentId, legalDocuments, signInConsent } from "./legal";

function openDocument(url: string) {
  void WebBrowser.openBrowserAsync(url);
}

/** A divided row that opens a public legal page in the in-app browser. */
export function LegalRow({ id, last }: { id: LegalDocumentId; last?: boolean }) {
  const document = legalDocuments[id];
  return (
    <Pressable
      onPress={() => openDocument(document.url)}
      role="link"
      accessibilityLabel={document.label}
      accessibilityHint="在浏览器中打开"
      className={cn(
        "flex-row items-center justify-between gap-3 border-t-hairline border-border py-3.5 active:bg-accent",
        last && "border-b-hairline",
      )}
    >
      <Text className="font-bold">{document.label}</Text>
      <Text className="text-muted-foreground">›</Text>
    </Pressable>
  );
}

export function LegalLinks() {
  return (
    <View>
      <LegalRow id="terms" />
      <LegalRow id="privacy" last />
    </View>
  );
}

/** Shown on the sign-in screen: logging in agrees to both documents. */
export function SignInConsent() {
  return (
    <Text className="text-muted-foreground">
      {signInConsent.before}
      <Text
        role="link"
        accessibilityRole="link"
        accessibilityLabel={signInConsent.terms.label}
        className="font-bold text-foreground"
        onPress={() => openDocument(signInConsent.terms.url)}
      >
        {signInConsent.terms.label}
      </Text>
      {signInConsent.between}
      <Text
        role="link"
        accessibilityRole="link"
        accessibilityLabel={signInConsent.privacy.label}
        className="font-bold text-foreground"
        onPress={() => openDocument(signInConsent.privacy.url)}
      >
        {signInConsent.privacy.label}
      </Text>
    </Text>
  );
}
