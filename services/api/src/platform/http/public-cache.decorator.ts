import { applyDecorators, Header } from "@nestjs/common";

export interface PublicCacheOptions {
  maxAgeSeconds: number;
  staleWhileRevalidateSeconds?: number;
  tags?: string[];
}

export function PublicCache(options: PublicCacheOptions): MethodDecorator {
  const stale = options.staleWhileRevalidateSeconds ?? 0;
  const directives = [
    "public",
    `max-age=${options.maxAgeSeconds}`,
    ...(stale > 0 ? [`stale-while-revalidate=${stale}`] : []),
  ].join(", ");
  const decorators: MethodDecorator[] = [
    Header("Cache-Control", "public, max-age=0, must-revalidate"),
    Header("Vercel-CDN-Cache-Control", directives),
  ];
  if (options.tags?.length) {
    decorators.push(Header("Vercel-Cache-Tag", options.tags.join(",")));
  }
  return applyDecorators(...decorators);
}
