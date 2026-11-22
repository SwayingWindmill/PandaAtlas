/* eslint-disable @next/next/no-img-element -- static QR code from /public. */
import type { AppDownloadLinks } from "@/lib/app-download";
import { hasAppDownload } from "@/lib/app-download";
import type { PublicLocale } from "@/lib/locales";

export const appPageCopy = {
  zh: {
    title: "把喜欢的熊猫装进口袋",
    description: "关注喜欢的熊猫，它们的资料有更新时，在 App 里收到通知。",
    features: [
      { title: "关注和动态", body: "关注的熊猫资料有更新，会在 App 里通知你，也可以选择收邮件。" },
      { title: "熊猫图鉴", body: "去动物园见过的熊猫，记进自己的图鉴。" },
      { title: "猜熊猫和每日熊猫", body: "看眼斑、认脸，每天一题。" },
      { title: "科普和词条", body: "熊猫科普文章随时读。" },
    ],
    ios: "App Store 下载",
    android: "Android 下载",
    testflight: "加入 TestFlight 测试",
    testflightOnly: "参加 iOS 测试",
    scan: "用手机扫码打开这一页",
    comingTitle: "App 即将上架。",
    comingBody: "上架后这里会放下载链接。",
    qrAlt: "打开吱熊猫 App 下载页的二维码",
  },
  en: {
    title: "Keep your favourite pandas in your pocket",
    description: "Follow the pandas you love and get notified in the app when their information is updated.",
    features: [
      { title: "Follows and updates", body: "When a panda you follow is updated, the app tells you. Email notices are optional." },
      { title: "Panda book", body: "Record the pandas you have seen at the zoo." },
      { title: "Guess Panda and Daily Panda", body: "Read the eye patches, recognise the face, one round a day." },
      { title: "Learn", body: "Read panda articles and terms any time." },
    ],
    ios: "Download on the App Store",
    android: "Download for Android",
    testflight: "Join the TestFlight beta",
    testflightOnly: "Join the iOS beta",
    scan: "Scan to open this page on your phone",
    comingTitle: "The app is coming soon.",
    comingBody: "Download links will appear here at launch.",
    qrAlt: "QR code for the ZhiPanda app download page",
  },
} as const;

const primaryButton = "inline-flex min-h-11 items-center rounded-full bg-[var(--pa-color-accent)] px-5 text-sm font-bold text-[var(--pa-color-on-accent)] hover:bg-[var(--pa-color-accent-hover)]";
const secondaryButton = "inline-flex min-h-11 items-center rounded-full bg-[var(--pa-color-surface-subtle)] px-5 text-sm font-bold hover:bg-[var(--pa-color-surface-hover)]";

export function AppDownloadPage({ locale, links }: { locale: PublicLocale; links: AppDownloadLinks }) {
  const copy = appPageCopy[locale];
  const available = hasAppDownload(links);
  return (
    <main id="main-content" className="pa-shell grid max-w-[42rem] gap-8 py-10 text-[var(--pa-color-ink)] sm:py-14">
      <header className="grid gap-3">
        <h1>{copy.title}</h1>
        <p className="text-[var(--pa-color-ink-muted)]">{copy.description}</p>
      </header>

      <dl className="grid border-t-[0.5px] border-[var(--pa-color-line)]">
        {copy.features.map((feature) => (
          <div key={feature.title} className="grid gap-1 border-b-[0.5px] border-[var(--pa-color-line)] py-3">
            <dt className="font-bold">{feature.title}</dt>
            <dd className="text-[var(--pa-color-ink-muted)]">{feature.body}</dd>
          </div>
        ))}
      </dl>

      {available ? (
        <div className="grid gap-6" data-testid="app-download-links">
          <div className="flex flex-wrap items-center gap-3">
            {links.ios ? <a href={links.ios} className={primaryButton}>{copy.ios}</a> : null}
            {links.android ? <a href={links.android} className={links.ios ? secondaryButton : primaryButton}>{copy.android}</a> : null}
            {links.testflight ? (
              links.ios || links.android ? (
                <a href={links.testflight} className="inline-flex min-h-11 items-center text-sm text-[var(--pa-color-ink-muted)] hover:underline">{copy.testflight}</a>
              ) : (
                <a href={links.testflight} className={primaryButton}>{copy.testflightOnly}</a>
              )
            ) : null}
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <img src={`/app-qr-${locale}.svg`} alt={copy.qrAlt} width={120} height={120} className="rounded-[var(--pa-radius-md)]" />
            <p className="text-sm text-[var(--pa-color-ink-muted)]">{copy.scan}</p>
          </div>
        </div>
      ) : (
        <p data-testid="app-coming-soon">
          <strong>{copy.comingTitle}</strong>
          <span className="ml-2 text-[var(--pa-color-ink-muted)]">{copy.comingBody}</span>
        </p>
      )}
    </main>
  );
}
