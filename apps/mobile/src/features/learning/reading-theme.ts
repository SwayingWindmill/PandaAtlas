import { useIOSColors } from "@/lib/theme";

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
 * 科普 reads on the same iOS system colors as the rest of the app.
 * The index sits on the grouped background. An article column sits on system background,
 * white in light mode and black in dark mode.
 */
export function useReadingTheme(): ReadingTheme {
  const colors = useIOSColors();
  return {
    dark: colors.scheme === "dark",
    canvas: colors.groupedBackground,
    paper: colors.background,
    card: colors.card,
    ink: colors.label,
    secondary: colors.secondaryLabel,
    separator: colors.separator,
    fill: colors.groupedBackground,
  };
}
