// Public legal pages. The website is the copy the app opens; the text lives there.

const SITE = "https://www.zhipanda.com";

export const legalDocuments = {
  terms: { label: "用户协议", url: `${SITE}/zh/terms` },
  privacy: { label: "隐私政策", url: `${SITE}/zh/privacy` },
} as const;

export type LegalDocumentId = keyof typeof legalDocuments;

/** The sign-in sentence, with the two document titles as the links. */
export const signInConsent = {
  before: "登录即表示同意",
  between: "和",
  terms: { label: "《用户协议》", url: legalDocuments.terms.url },
  privacy: { label: "《隐私政策》", url: legalDocuments.privacy.url },
} as const;

export function signInConsentText(): string {
  return `${signInConsent.before}${signInConsent.terms.label}${signInConsent.between}${signInConsent.privacy.label}`;
}
