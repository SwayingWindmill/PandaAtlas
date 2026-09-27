import type { CSSProperties, ReactNode } from "react";

const fontVariables = {
  "--v08-font-latin": '"Avenir Next", "Segoe UI", Arial, sans-serif',
  "--v08-font-body-cjk": '"Noto Sans SC", "PingFang SC", "Microsoft YaHei"',
  "--v08-font-display-cjk": '"Noto Serif SC", "Songti SC", "STSong", "SimSun"',
  "--v08-font-body": '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Avenir Next", "Segoe UI", Arial, sans-serif',
  "--v08-font-display": '"Noto Serif SC", "Songti SC", "STSong", "SimSun", "Palatino Linotype", Georgia, serif',
} as CSSProperties;

export default function FanV08PrototypeLayout({ children }: { children: ReactNode }) {
  return <div style={fontVariables}>{children}</div>;
}
