import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { Chevron } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Mars, Venus } from "@/components/icons";
import { PhotoOutline } from "@/components/photo-outline";
import { Text } from "@/components/ui/text";
import { type TextPart, highlightParts } from "@/features/pandas/highlight";
import { type PandaListItem, listMeta, normalizeTerm } from "@/features/pandas/pandas";
import { usePandaCover } from "@/lib/covers";
import { nameInitial } from "@/lib/panda";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

export function openPanda(slug: string) {
  router.push({ pathname: "/pandas/[slug]", params: { slug } });
}

const SEX: Record<string, string> = { male: "雄性", female: "雌性" };

/** The row's photo, and where the separator under it starts: under the name, past the photo. */
const PHOTO = 44;
const SEPARATOR_INSET = { marginLeft: 16 + PHOTO + 12 } as const;

function Marked({ parts, variant }: { parts: TextPart[]; variant: "body" | "subheadline" }) {
  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          <Text key={index} variant={variant} className="bg-highlight-soft text-primary">
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

/**
 * One panda in a list, as Music lists albums: its cover in a small rounded square, the name in
 * headline and where it lives and when it was born under it. Consecutive rows read as one inset
 * group: `first` and `last` round the group's corners, and the separator stops before the last row.
 * With a `highlight` query, the characters it matched in the name or the place are tinted; a row matched
 * through pinyin or a Latin name has nothing to point at, so its whole name is tinted.
 */
export const PandaRow = memo(function PandaRow({
  item,
  first = false,
  last,
  highlight,
  onOpen,
}: {
  item: PandaListItem;
  first?: boolean;
  last: boolean;
  highlight?: string;
  onOpen?: () => void;
}) {
  const photo = usePandaCover(item.id);
  const meta = listMeta(item);
  const nameHit = highlight ? highlightParts(item.name, highlight) : null;
  const placeHit = highlight && item.place ? highlightParts(item.place, highlight) : null;
  const nameParts = nameHit ?? (highlight && normalizeTerm(highlight) && !placeHit ? [{ text: item.name, hit: true }] : null);
  const metaParts = placeHit && item.place ? [...placeHit, { text: meta.slice(item.place.length), hit: false }] : null;
  return (
    <View
      className={cn("overflow-hidden bg-card", first && "rounded-t-group", last && "rounded-b-group")}
      style={{ borderCurve: "continuous" }}
    >
      <Pressable
        onPress={() => {
          onOpen?.();
          openPanda(item.slug);
        }}
        role="button"
        accessibilityLabel={[item.name, SEX[item.sex ?? ""], meta].filter(Boolean).join("，")}
        className="min-h-11 flex-row items-center gap-row px-inset py-stack-tight active:bg-accent"
      >
        <View
          className="items-center justify-center overflow-hidden rounded-full bg-secondary"
          style={{ width: PHOTO, height: PHOTO, borderCurve: "continuous" }}
        >
          {photo ? (
            <Image source={photo} style={{ width: PHOTO, height: PHOTO }} contentFit="cover" accessible={false} />
          ) : (
            <Text variant="headline" className="text-muted-foreground">
              {nameInitial(item.name)}
            </Text>
          )}
          {photo ? <PhotoOutline radius={PHOTO / 2} /> : null}
        </View>
        <View className="min-w-0 flex-1 gap-hair-gap">
          <View className="flex-row items-center gap-hair-gap">
            <Text variant="body" className="shrink" numberOfLines={1}>
              {nameParts ? <Marked parts={nameParts} variant="body" /> : item.name}
            </Text>
            {item.sex ? <Icon icon={item.sex === "female" ? Venus : Mars} size="footnote" /> : null}
          </View>
          {meta ? (
            <Text variant="subheadline" className="text-muted-foreground" numberOfLines={1}>
              {metaParts ? <Marked parts={metaParts} variant="subheadline" /> : meta}
            </Text>
          ) : null}
        </View>
        <Chevron />
      </Pressable>
      {last ? null : <View className="bg-border" style={[{ height: HAIRLINE }, SEPARATOR_INSET]} />}
    </View>
  );
});
