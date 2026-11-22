// Store links come from the environment so the app page and the open-in-app bar
// switch on at launch without a code change. Unset means "not available yet".
export interface AppDownloadLinks {
  ios: string | null;
  android: string | null;
  testflight: string | null;
  /** Numeric App Store id; enables Safari's own Smart App Banner. */
  iosStoreId: string | null;
}

function httpsUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

export function appDownloadLinks(): AppDownloadLinks {
  const storeId = process.env.NEXT_PUBLIC_APP_IOS_STORE_ID?.trim();
  return {
    ios: httpsUrl(process.env.NEXT_PUBLIC_APP_IOS_URL),
    android: httpsUrl(process.env.NEXT_PUBLIC_APP_ANDROID_URL),
    testflight: httpsUrl(process.env.NEXT_PUBLIC_APP_TESTFLIGHT_URL),
    iosStoreId: storeId && /^\d+$/u.test(storeId) ? storeId : null,
  };
}

export function hasAppDownload(links: AppDownloadLinks): boolean {
  return Boolean(links.ios || links.android || links.testflight);
}
