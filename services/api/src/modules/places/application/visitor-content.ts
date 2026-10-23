import { DomainError } from "../../../platform/errors/domain-error.js";

/** Text a fan reads, in one or both public languages. */
export interface LocalizedText {
  zh?: string;
  en?: string;
}

export const INSTITUTION_KINDS = ["zoo", "breeding_center", "wildlife_park"] as const;
export type InstitutionKind = (typeof INSTITUTION_KINDS)[number];

/** What a fan needs to know about the organization that keeps pandas. */
export interface InstitutionProfile {
  kind: InstitutionKind;
  summary?: LocalizedText;
  websiteUrl?: string;
  liveCamUrl?: string;
  /** The day an editor last checked the profile against its sources. */
  verifiedOn: string;
  sourceUrls: string[];
}

export const VISIT_TIP_TOPICS = ["best_time", "finding_pandas", "getting_there", "good_to_know"] as const;
export type VisitTipTopic = (typeof VISIT_TIP_TOPICS)[number];

/** How to see the pandas at one facility. Opening hours and prices change, so each guide is dated. */
export interface FacilityVisitGuide {
  address?: LocalizedText;
  openingHours?: LocalizedText;
  admission?: LocalizedText;
  pandaArea?: LocalizedText;
  tips: Array<{ topic: VisitTipTopic; text: LocalizedText }>;
  verifiedOn: string;
  sourceUrls: string[];
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 600;

function invalid(code: string, message: string): never {
  throw new DomainError("invalid", `places.${code}`, message);
}

function assertText(value: LocalizedText | undefined, field: string): void {
  if (value === undefined) return;
  const parts = [value.zh, value.en].filter((part): part is string => part !== undefined);
  if (parts.length === 0) invalid("visitorTextEmpty", `${field} needs Chinese or English text.`);
  for (const part of parts) {
    if (part.trim().length === 0 || part.length > MAX_TEXT) {
      invalid("visitorTextLength", `${field} must be between 1 and ${MAX_TEXT} characters.`);
    }
  }
}

function assertHttpsUrl(value: string | undefined, field: string): void {
  if (value === undefined) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid("visitorUrl", `${field} must be an absolute URL.`);
  }
  if (url.protocol !== "https:") invalid("visitorUrl", `${field} must use https.`);
}

function assertSourced(verifiedOn: string, sourceUrls: string[], field: string): void {
  if (!ISO_DAY.test(verifiedOn) || Number.isNaN(Date.parse(`${verifiedOn}T00:00:00Z`))) {
    invalid("visitorVerifiedOn", `${field}.verifiedOn must be a YYYY-MM-DD day.`);
  }
  if (sourceUrls.length === 0) invalid("visitorSources", `${field} needs at least one source URL.`);
  sourceUrls.forEach((source, index) => assertHttpsUrl(source, `${field}.sourceUrls[${index}]`));
}

export function assertInstitutionProfile(profile: InstitutionProfile | undefined): void {
  if (profile === undefined) return;
  if (!INSTITUTION_KINDS.includes(profile.kind)) invalid("institutionKind", "The institution kind is not supported.");
  assertText(profile.summary, "profile.summary");
  assertHttpsUrl(profile.websiteUrl, "profile.websiteUrl");
  assertHttpsUrl(profile.liveCamUrl, "profile.liveCamUrl");
  assertSourced(profile.verifiedOn, profile.sourceUrls, "profile");
}

export function assertFacilityVisitGuide(guide: FacilityVisitGuide | undefined): void {
  if (guide === undefined) return;
  assertText(guide.address, "visitGuide.address");
  assertText(guide.openingHours, "visitGuide.openingHours");
  assertText(guide.admission, "visitGuide.admission");
  assertText(guide.pandaArea, "visitGuide.pandaArea");
  guide.tips.forEach((tip, index) => {
    if (!VISIT_TIP_TOPICS.includes(tip.topic)) invalid("visitTipTopic", `visitGuide.tips[${index}] has an unknown topic.`);
    if (tip.text === undefined) invalid("visitorTextEmpty", `visitGuide.tips[${index}] needs text.`);
    assertText(tip.text, `visitGuide.tips[${index}].text`);
  });
  assertSourced(guide.verifiedOn, guide.sourceUrls, "visitGuide");
}
