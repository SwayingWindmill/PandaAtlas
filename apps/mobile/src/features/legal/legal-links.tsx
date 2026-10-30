import * as WebBrowser from "expo-web-browser";

import { ListCell, ListSection } from "@/components/grouped-list";
import type { LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";

import { type LegalDocumentId, legalDocuments, signInConsent } from "./legal";

function openDocument(url: string) {
  void WebBrowser.openBrowserAsync(url);
}

/** A grouped row that opens a public legal page in the in-app browser. */
export function LegalRow({ id, last, glyph }: { id: LegalDocumentId; last?: boolean; glyph?: LucideIcon }) {
  const document = legalDocuments[id];
  return (
    <ListCell
      label={document.label}
      last={last}
      glyph={glyph}
      onPress={() => openDocument(document.url)}
      role="link"
      accessibilityLabel={document.label}
    />
  );
}

export function LegalLinks() {
  return (
    <ListSection>
      <LegalRow id="terms" />
      <LegalRow id="privacy" last />
    </ListSection>
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
        className="font-semibold text-primary"
        onPress={() => openDocument(signInConsent.terms.url)}
      >
        {signInConsent.terms.label}
      </Text>
      {signInConsent.between}
      <Text
        role="link"
        accessibilityRole="link"
        accessibilityLabel={signInConsent.privacy.label}
        className="font-semibold text-primary"
        onPress={() => openDocument(signInConsent.privacy.url)}
      >
        {signInConsent.privacy.label}
      </Text>
    </Text>
  );
}
