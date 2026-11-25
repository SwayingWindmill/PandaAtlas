import { router } from "expo-router";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Mars, Venus } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { Text } from "@/components/ui/text";
import { type TextPart, highlightParts } from "@/features/pandas/highlight";
import { type PandaListItem, listMeta, normalizeTerm } from "@/features/pandas/pandas";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

export function openPanda(slug: string) {
  router.push({ pathname: "/pandas/[slug]", params: { slug } });
}

const SEX: Record<string, string> = { male: "雄性", female: "雌性" };

/** The row's photo, and where the separator under it starts: under the name, past the photo. */
const PHOTO = 44;
const SEPARATOR_INSET = { marginLeft: 16 + PHOTO + 12 } as const;

function Marked({ parts, variant }: { parts: TextPart[]; variant: "body" | "subheadline" | "footnote" }) {
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
 * One panda in a list: its cover in a circular avatar, the name in
 * headline and where it lives and when it was born under it. Consecutive rows read as one inset
 * group: `first` and `last` round the group's corners, and the separator stops before the last row.
 * With a `highlight` query, the characters it matched in the name, place or studbook are tinted; a row matched
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
  const stacked = useStacked();
  const meta = listMeta(item);
  const nameHit = highlight ? highlightParts(item.name, highlight) : null;
  const placeHit = highlight && item.place ? highlightParts(item.place, highlight) : null;
  const studbookHit = highlight && item.studbookNumber ? highlightParts(item.studbookNumber, highlight) : null;
  const nameParts =
    nameHit ??
    (highlight && normalizeTerm(highlight) && !placeHit && !studbookHit ? [{ text: item.name, hit: true }] : null);
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
        accessibilityLabel={[
          item.name,
          SEX[item.sex ?? ""],
          item.studbookNumber ? `谱系号 ${item.studbookNumber}` : null,
          meta,
        ]
          .filter(Boolean)
          .join("，")}
        className="min-h-11 flex-row items-center gap-row px-inset py-stack-tight active:bg-accent"
      >
        <PandaThumb pandaId={item.id} name={item.name} size={PHOTO} />
        <View className="min-w-0 flex-1 gap-hair-gap">
          <View className={cn("flex-row items-center gap-hair-gap", stacked && "flex-wrap")}>
            <Text variant="body" className="shrink" numberOfLines={stacked ? undefined : 1}>
              {nameParts ? <Marked parts={nameParts} variant="body" /> : item.name}
            </Text>
            {item.sex ? <Icon icon={item.sex === "female" ? Venus : Mars} size="footnote" /> : null}
            {item.studbookNumber ? (
              <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
                {studbookHit ? <Marked parts={studbookHit} variant="footnote" /> : item.studbookNumber}
              </Text>
            ) : null}
          </View>
          {meta ? (
            <Text variant="subheadline" className="text-muted-foreground" numberOfLines={stacked ? undefined : 1}>
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
