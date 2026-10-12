import {
  PUBLIC_EXPERIENCE_RELEASE,
  TRUSTED_FAMILY_STORIES,
  TRUSTED_PROFILE_COHORT,
} from "@/lib/generated/public-experiences";
import type {
  LocalizedEditorialContent,
  PublicFamilyStoryRecord,
  PublicProfileCohortRecord,
} from "@/lib/types";

export type PublicExperienceLocale = "zh" | "en";

export const publicExperienceRelease = PUBLIC_EXPERIENCE_RELEASE;

export function localizedEditorial(
  content: LocalizedEditorialContent[],
  locale: PublicExperienceLocale,
): LocalizedEditorialContent {
  const preferred = locale === "zh" ? "zh-CN" : "en";
  return content.find((item) => item.locale === preferred)
    ?? content.find((item) => item.locale === "en")
    ?? content[0]
    ?? { locale: preferred, title: "", summary: "" };
}

export function getProfileCohortState(slug: string): PublicProfileCohortRecord["state"] {
  return TRUSTED_PROFILE_COHORT.find((item) => item.slug === slug)?.state ?? "standard";
}

export function listFamilyStories(): PublicFamilyStoryRecord[] {
  return [...TRUSTED_FAMILY_STORIES].sort((left, right) => left.slug.localeCompare(right.slug));
}

export function getFamilyStory(reference: string): PublicFamilyStoryRecord | null {
  return TRUSTED_FAMILY_STORIES.find(
    (story) => story.slug === reference || story.id === reference,
  ) ?? null;
}

export function familyStoriesForPanda(pandaId: string): PublicFamilyStoryRecord[] {
  return listFamilyStories().filter((story) => story.member_ids.includes(pandaId));
}
