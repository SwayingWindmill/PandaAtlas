import type { Photo } from "@/features/pandas/profile";

export function shareText(photo: Photo, name: string): string {
  return [name, photo.credit].filter(Boolean).join("\n");
}

// File systems cap a name at 255 bytes, not characters, and a CJK character takes three.
const MAX_STEM_BYTES = 200;

function utf8Length(char: string): number {
  const codePoint = char.codePointAt(0) ?? 0;
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  return codePoint < 0x10000 ? 3 : 4;
}

/**
 * Names the file after the panda and the credit. Android's share sheet carries no text with a file,
 * so the file name is the only place the credit travels there. `#` and `%` would break its file URI.
 */
export function fileName(photo: Photo, name: string): string {
  const extension = /\.(jpe?g|png|webp|heic|gif)(?:$|[?#])/i.exec(photo.url)?.[1]?.toLowerCase() ?? "jpg";
  const words = [name, photo.credit]
    .filter(Boolean)
    .join(" ")
    .replace(/[\\/:*?"<>|#%\u0000-\u001f\s]+/g, " ")
    .trim();
  let stem = "";
  let bytes = 0;
  for (const char of words) {
    bytes += utf8Length(char);
    if (bytes > MAX_STEM_BYTES) break;
    stem += char;
  }
  return `${stem.trim() || photo.id}.${extension}`;
}
