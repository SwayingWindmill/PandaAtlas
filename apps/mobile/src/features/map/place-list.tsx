import { Pressable, View } from "react-native";

import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { type LucideIcon, MapPin } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { Text } from "@/components/ui/text";
import { HAIRLINE } from "@/lib/surface";

import { type MapItem, mapItemLabel, pandaCountLabel } from "./model";

const THUMB = 52;
/** The separator starts under the name, past the photo: inset 16 + photo + gap 12. */
const SEPARATOR_INSET = { marginLeft: 16 + THUMB + 12 } as const;

export interface PlaceRow {
  key: string;
  name: string;
  detail: string | null;
  /** How many pandas live there now; shown at the trailing edge when there are any. */
  count: number;
  /** The panda whose cover leads the row. */
  lead: { id: string; name: string } | undefined;
  accessibilityLabel: string;
  onPress: () => void;
}

/** The place's first resident, or a glyph on the fill when nobody lives there now. */
function Thumb({ lead, icon }: { lead: PlaceRow["lead"]; icon: LucideIcon }) {
  if (lead) return <PandaThumb pandaId={lead.id} name={lead.name} size={THUMB} />;
  return (
    <View
      className="items-center justify-center rounded-control bg-secondary"
      style={{ width: THUMB, height: THUMB, borderCurve: "continuous" }}
    >
      <Icon icon={icon} tone="secondary" />
    </View>
  );
}

/**
 * Places as Maps lists a guide: an inset group where each row leads with a photo of a panda that
 * lives there, the name in headline, and a second line under it.
 */
export function PlaceRows({ rows, icon = MapPin }: { rows: PlaceRow[]; icon?: LucideIcon }) {
  // At accessibility sizes the photo goes above the text and the count joins the second line,
  // as iOS stacks a cell, so the name keeps the full width.
  const stacked = useStacked();
  return (
    <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
      {rows.map((row, index) => (
        <View key={row.key}>
          <Pressable
            onPress={row.onPress}
            role="button"
            accessibilityLabel={row.accessibilityLabel}
            className={
              stacked
                ? "min-h-11 gap-stack-tight px-inset py-row active:bg-accent"
                : "min-h-11 flex-row items-center gap-row px-inset py-stack-tight active:bg-accent"
            }
          >
            <Thumb lead={row.lead} icon={icon} />
            <View className={stacked ? "gap-hair-gap" : "min-w-0 flex-1 gap-hair-gap"}>
              <Text variant="headline" numberOfLines={stacked ? undefined : 2}>
                {row.name}
              </Text>
              {row.detail ? (
                <Text variant="subheadline" className="text-muted-foreground" numberOfLines={stacked ? undefined : 2}>
                  {row.detail}
                </Text>
              ) : null}
              {stacked && row.count > 0 ? (
                <Text variant="subheadline" className="text-muted-foreground tabular-nums">{`${row.count} 只`}</Text>
              ) : null}
            </View>
            {stacked ? null : row.count > 0 ? (
              <Text variant="subheadline" className="text-muted-foreground tabular-nums">
                {`${row.count} 只`}
              </Text>
            ) : null}
            {stacked ? null : <Chevron />}
          </Pressable>
          {index === rows.length - 1 ? null : <View className="bg-border" style={[{ height: HAIRLINE }, stacked ? { marginLeft: 16 } : SEPARATOR_INSET]} />}
        </View>
      ))}
    </View>
  );
}

/** Map places as rows: who lives there under the name, and where, for a place abroad. */
export function MapRows({ items, onOpen }: { items: MapItem[]; onOpen: (item: MapItem) => void }) {
  return (
    <PlaceRows
      rows={items.map((item) => ({
        key: item.id,
        name: item.name,
        detail: [item.overseas ? item.where : null, item.residentNames ?? pandaCountLabel(item.residentCount)]
          .filter(Boolean)
          .join("　"),
        count: item.residentCount,
        lead: item.residents[0],
        accessibilityLabel: mapItemLabel(item),
        onPress: () => onOpen(item),
      }))}
    />
  );
}
