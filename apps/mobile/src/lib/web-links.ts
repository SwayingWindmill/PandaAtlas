// A link to www.zhipanda.com opened on a phone with the app (a Universal Link or an Android App Link) arrives
// with the web's locale in front: /zh/pandas/a-bao. The app's routes have no locale.

const WEB_HOST = "www.zhipanda.com";
const LOCALE_PAGE = /^\/(?:zh|en)(\/(?:pandas|institutions|places)\/[^/?#]+)\/?$/;

/** The app route for a link the system hands the app; anything else passes through unchanged. */
export function appPathForLink(link: string): string {
  let url: URL;
  try {
    url = new URL(link, `https://${WEB_HOST}`);
  } catch {
    return link;
  }
  if (url.host !== WEB_HOST) return link;
  const page = LOCALE_PAGE.exec(url.pathname);
  return page?.[1] ?? link;
}
