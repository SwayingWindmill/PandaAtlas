import { Manrope, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--fan-review-font-latin",
});

const notoSansSc = Noto_Sans_SC({
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--fan-review-font-body-cjk",
});

const notoSerifSc = Noto_Serif_SC({
  weight: ["500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--fan-review-font-display-cjk",
});

export default function FanV07ReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${manrope.variable} ${notoSansSc.variable} ${notoSerifSc.variable}`}>
      {children}
    </div>
  );
}
