import { Manrope, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--v08-font-latin",
});

const notoSansSc = Noto_Sans_SC({
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--v08-font-body-cjk",
});

const notoSerifSc = Noto_Serif_SC({
  weight: ["500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--v08-font-display-cjk",
});

export default function FanV08PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${manrope.variable} ${notoSansSc.variable} ${notoSerifSc.variable}`}>
      {children}
    </div>
  );
}
