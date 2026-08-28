const PUBLIC_MEDIA_BASE_URL = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "https://api.zhipanda.com/media").replace(/\/$/, "");

export function publicMediaUrl(objectKey: string): string {
  if (/^https?:\/\//i.test(objectKey)) return objectKey;
  return `${PUBLIC_MEDIA_BASE_URL}/${objectKey.replace(/^\/+/, "")}`;
}
