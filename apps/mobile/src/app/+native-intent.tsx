import { appPathForLink } from "@/lib/web-links";

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return appPathForLink(path);
}
