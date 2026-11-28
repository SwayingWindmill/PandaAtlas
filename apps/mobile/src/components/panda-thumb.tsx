import { useMemo, useState } from "react";

import { PhotoOutline } from "@/components/photo-outline";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { usePandaCover } from "@/lib/covers";
import { nameInitial } from "@/lib/panda";
import { RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

/**
 * A panda's cover at row size: round by default on `@/components/ui/avatar`, with an initial-letter
 * fallback when no cover is available or loading fails. Pass `shape="tile"` only for square album
 * cells (图鉴). Always decorative: the row or button around it carries the accessible label.
 */
export function PandaThumb({
  pandaId,
  name,
  size,
  photoUrl,
  shape = "round",
  className,
}: {
  pandaId: string;
  name: string;
  size: number;
  photoUrl?: string | null;
  /** "tile" is reserved for square album grid cells (图鉴), at the photo radius. */
  shape?: "round" | "tile";
  className?: string;
}) {
  const cover = usePandaCover(photoUrl ? undefined : pandaId);
  const uri = photoUrl || cover || null;
  const source = useMemo(() => (uri ? { uri } : undefined), [uri]);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = Boolean(uri && failedUri === uri);
  const radius = shape === "tile" ? RADIUS.tile : size / 2;

  return (
    <Avatar
      alt={name}
      className={cn(
        "items-center justify-center bg-secondary",
        shape === "tile" ? "rounded-tile" : "rounded-full",
        className,
      )}
      style={{ width: size, height: size, borderRadius: radius, borderCurve: "continuous" }}
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
    >
      {source ? (
        <AvatarImage
          key={uri}
          source={source}
          resizeMode="cover"
          style={{ width: size, height: size }}
          accessible={false}
          onLoadingStatusChange={(status) => setFailedUri(status === "error" ? uri : null)}
        />
      ) : null}
      <AvatarFallback
        role="none"
        aria-label={undefined}
        className={cn("bg-secondary", shape === "tile" && "rounded-none")}
      >
        <Text
          variant={size >= 48 ? "title" : "headline"}
          role="none"
          allowFontScaling={false}
          className="text-muted-foreground"
        >
          {nameInitial(name)}
        </Text>
      </AvatarFallback>
      {source && !failed ? <PhotoOutline radius={radius} /> : null}
    </Avatar>
  );
}
