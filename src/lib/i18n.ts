export type Locale = "zh" | "en";

export function pickLocalizedText(
  locale: Locale,
  zh?: string | null,
  en?: string | null
): string {
  if (locale === "en") {
    return en?.trim() || zh?.trim() || "";
  }
  return zh?.trim() || en?.trim() || "";
}
