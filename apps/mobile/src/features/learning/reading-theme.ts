import { useUniwind } from "uniwind";

export interface ReadingTheme {
  dark: boolean;
  canvas: string;
  paper: string;
  card: string;
  ink: string;
  secondary: string;
  separator: string;
  fill: string;
}

/**
 * 科普 articles use iOS system colors. Apple News and Settings read on white and true black,
 * not the atlas olive, so a long column keeps the contrast a phone reader expects.
 * The rest of the app stays on the olive tokens.
 */
export function useReadingTheme(): ReadingTheme {
  const { theme } = useUniwind();
  const dark = theme === "dark";
  return {
    dark,
    canvas: dark ? "#000000" : "#F2F2F7",
    paper: dark ? "#000000" : "#FFFFFF",
    card: dark ? "#1C1C1E" : "#FFFFFF",
    ink: dark ? "#FFFFFF" : "#000000",
    secondary: dark ? "#AEAEB2" : "#636366",
    separator: dark ? "#38383A" : "#C6C6C8",
    fill: dark ? "#1C1C1E" : "#F2F2F7",
  };
}
