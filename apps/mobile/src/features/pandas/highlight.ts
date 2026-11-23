export interface TextPart {
  text: string;
  hit: boolean;
}

export function highlightParts(text: string, query: string): TextPart[] | null {
  const needle = query.trim().toLowerCase();
  const start = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (start < 0) return null;
  const end = start + needle.length;
  return [
    { text: text.slice(0, start), hit: false },
    { text: text.slice(start, end), hit: true },
    { text: text.slice(end), hit: false },
  ].filter((part) => part.text);
}
