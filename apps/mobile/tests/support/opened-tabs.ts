import type { Browser } from "@e2e-dev/web";

// The app opens outside pages (legal pages, sources) in a new tab through window.open, and e2e does not follow a
// tab the app opens. recordOpenedTabs makes the page note each window.open call instead of opening it, and
// openedTabs reads back where they went.

export async function recordOpenedTabs(browser: Browser): Promise<void> {
  await browser.addInitScript(() => {
    const page = window as unknown as { opened: string[] };
    page.opened = [];
    window.open = (url?: string | URL) => {
      page.opened.push(String(url));
      return null;
    };
  });
}

export function openedTabs(browser: Browser): Promise<string[]> {
  return browser.evaluate(() => (window as unknown as { opened?: string[] }).opened ?? []) as Promise<string[]>;
}
