export const FEEDBACK_EMAIL = "hello@zhipanda.com";

export interface AppBuild {
  version: string;
  /** The store build number; null on the web and in builds that report none. */
  build: string | null;
  os: string;
  osVersion: string | number;
}

/** "0.1.0 (42)", or "0.1.0" when there is no build number. */
export function versionLabel({ version, build }: AppBuild): string {
  return build ? `${version} (${build})` : version;
}

/** A mailto: link to 吱熊猫 with the version and the device filled in, so a report says what it ran on. */
export function feedbackMailto(app: AppBuild): string {
  const subject = "吱熊猫反馈";
  const body = ["", "", "——", `App 版本：${versionLabel(app)}`, `系统：${app.os} ${app.osVersion}`].join("\n");
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
