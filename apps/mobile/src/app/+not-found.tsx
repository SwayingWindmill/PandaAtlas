import { router } from "expo-router";

import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";

/** A deep link or an old link to a route the app no longer has. */
export default function NotFoundScreen() {
  return (
    <Page title="找不到页面">
      <ScreenState message="这个链接可能已经失效，或者页面已经搬走了。" actionLabel="回首页" onAction={() => router.replace("/")} />
    </Page>
  );
}
