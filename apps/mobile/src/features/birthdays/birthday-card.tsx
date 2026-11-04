import { Image } from "expo-image";
import { type ComponentRef, type RefObject, useId, useState } from "react";
import { type LayoutChangeEvent, type TextStyle, View } from "react-native";
import Svg, { Defs, LinearGradient, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

import { Icon } from "@/components/icon";
import { Cake } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { dayHeading } from "@/features/calendar/calendar";
import { component, primitive } from "@/design/tokens";

import { whenLabel } from "./birthday-week";

export type BirthdayCardStyle = "cover" | "medal" | "poster";

export const BIRTHDAY_CARD_STYLES: readonly { value: BirthdayCardStyle; label: string }[] = [
  { value: "cover", label: "封面" },
  { value: "medal", label: "奖章" },
  { value: "poster", label: "海报" },
];

export interface BirthdayCardData {
  name: string;
  nameEn: string | null;
  /** The age it turns. */
  age: number;
  birthDate: string;
  /** The birthday this card is for, YYYY-MM-DD. */
  date: string;
  inDays: number;
  sex: "male" | "female" | null;
  photo: { url: string; credit: string | null } | null;
}

const { jade, shoot, gray } = primitive.palette;
/**
 * The card is an image: drawn on a 360×480 artboard and scaled to the width it gets, so the saved PNG
 * looks the same at every text size. VoiceOver reads the whole card from its label instead.
 */
const BC = component.birthdayCard;
const ARTBOARD = BC.artboard.width;
const WHITE = gray.white;

/** 21 → "21ST", 12 → "12TH". */
export function ordinal(n: number) {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "TH" : (["TH", "ST", "ND", "RD"][n % 10] ?? "TH");
  return `${n}${suffix}`;
}

function dotted(date: string) {
  return date.replaceAll("-", ".");
}

function birthLine(card: BirthdayCardData) {
  const [y, m, d] = card.birthDate.split("-");
  const sex = card.sex === "male" ? "雄" : card.sex === "female" ? "雌" : null;
  return [`${y} 年 ${Number(m)} 月 ${Number(d)} 日出生`, sex].filter(Boolean).join(" · ");
}

function when(card: BirthdayCardData) {
  return card.inDays === 0 ? "今天生日" : `${whenLabel(card.inDays)}生日`;
}

/** What VoiceOver reads for the card: everything printed on it, in reading order. */
export function birthdayCardLabel(card: BirthdayCardData) {
  return [
    `${card.name} ${card.age} 岁生日卡`,
    when(card),
    dayHeading(card.date),
    birthLine(card),
    card.photo?.credit,
  ]
    .filter(Boolean)
    .join("，");
}

/** Text on the artboard: a size in artboard points, never scaled again by Dynamic Type. */
function T({
  size,
  u,
  className,
  style,
  lines,
  children,
}: {
  size: number;
  u: number;
  className?: string;
  style?: TextStyle;
  lines?: number;
  children: React.ReactNode;
}) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={lines}
      className={className}
      style={[{ fontSize: size * u, lineHeight: Math.round(size * u * 1.2) }, style]}
    >
      {children}
    </Text>
  );
}

function Photo({ url, style }: { url: string; style?: object }) {
  return (
    <Image
      source={url}
      contentFit="cover"
      contentPosition={{ left: "38%", top: "50%" }}
      accessible={false}
      style={[{ width: "100%", height: "100%", backgroundColor: gray[700] }, style]}
    />
  );
}

/** A 回忆封面: the photo full bleed, the age large in 笋金, the name and the credit on a jade scrim. */
function Cover({ card, u }: { card: BirthdayCardData; u: number }) {
  const id = useId().replaceAll(":", "");
  const pill = { backgroundColor: BC.pill, paddingHorizontal: 11 * u, paddingVertical: 6 * u } as const;
  return (
    <View className="absolute inset-0" style={{ backgroundColor: jade[950] }}>
      {card.photo ? <Photo url={card.photo.url} /> : null}
      <Svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1">
        <Defs>
          <LinearGradient id={`scrim${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={jade[950]} stopOpacity={0.35} />
            <Stop offset="0.22" stopColor={jade[950]} stopOpacity={0} />
            <Stop offset="0.45" stopColor={jade[950]} stopOpacity={0} />
            <Stop offset="0.82" stopColor={jade[950]} stopOpacity={0.88} />
            <Stop offset="1" stopColor={jade[950]} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#scrim${id})`} />
      </Svg>
      <View className="absolute flex-row justify-between" style={{ top: 20 * u, left: 20 * u, right: 20 * u }}>
        <View className="flex-row items-center rounded-full" style={[pill, { gap: 4 * u }]}>
          <Icon icon={Cake} size={14 * u} color={WHITE} strokeWidth={2.2} />
          <T u={u} size={13} className="font-semibold" style={{ color: WHITE }}>
            {when(card)}
          </T>
        </View>
        <View className="rounded-full" style={pill}>
          <T u={u} size={13} className="font-semibold" style={{ color: WHITE }}>
            {dayHeading(card.date).split(" ")[0]}
          </T>
        </View>
      </View>
      <View className="absolute" style={{ left: 22 * u, right: 22 * u, bottom: 20 * u }}>
        <View className="flex-row items-baseline" style={{ gap: 6 * u }}>
          <T u={u} size={112} className="font-rounded font-extrabold tabular-nums" style={{ color: shoot[300], lineHeight: 100 * u }}>
            {card.age}
          </T>
          <T u={u} size={22} className="font-semibold" style={{ color: shoot[300] }}>
            岁
          </T>
        </View>
        <View className="flex-row items-baseline" style={{ gap: 8 * u, marginTop: 6 * u }}>
          <T u={u} size={40} lines={1} className="shrink font-bold" style={{ color: WHITE }}>
            {card.name}
          </T>
          {card.nameEn ? (
            <T u={u} size={17} lines={1} className="shrink font-semibold" style={{ color: WHITE, opacity: 0.7 }}>
              {card.nameEn}
            </T>
          ) : null}
        </View>
        <T u={u} size={13} style={{ color: WHITE, opacity: 0.75, marginTop: 6 * u }}>
          {birthLine(card)}
        </T>
        <View
          className="flex-row items-center justify-between"
          style={{ gap: 12 * u, marginTop: 16 * u, paddingTop: 12 * u, borderTopWidth: 0.5, borderColor: BC.rule }}
        >
          <T u={u} size={13} className="font-bold" style={{ color: WHITE }}>
            吱熊猫
          </T>
          {card.photo?.credit ? (
            <T u={u} size={11} lines={2} className="shrink text-right" style={{ color: WHITE, opacity: 0.8 }}>
              {card.photo.credit}
            </T>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** B 奖章: the photo in a brass ring, the age on a medal under it, the dates between birth and this birthday. */
function Medal({ card, u }: { card: BirthdayCardData; u: number }) {
  const id = useId().replaceAll(":", "");
  const ring = 212 * u;
  const badge = 76 * u;
  return (
    <View className="absolute inset-0 items-center">
      <Svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1">
        <Defs>
          <RadialGradient id={`bg${id}`} cx="0.5" cy="0.3" rx="0.6" ry="0.8">
            <Stop offset="0" stopColor={BC.medalLight} />
            <Stop offset="0.6" stopColor={jade[950]} />
            <Stop offset="1" stopColor={BC.medalDeep} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#bg${id})`} />
      </Svg>
      <View style={{ marginTop: 44 * u, width: ring, height: ring, borderRadius: ring / 2, padding: 7 * u, overflow: "hidden" }}>
        <Svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%" viewBox="0 0 1 1">
          <Defs>
            <LinearGradient id={`ring${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={shoot[50]} />
              <Stop offset="0.35" stopColor={shoot[300]} />
              <Stop offset="0.6" stopColor={shoot[700]} />
              <Stop offset="0.8" stopColor={shoot[300]} />
              <Stop offset="1" stopColor={shoot[50]} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="1" height="1" fill={`url(#ring${id})`} />
        </Svg>
        <View className="flex-1 overflow-hidden rounded-full" style={{ backgroundColor: jade[950], padding: 5 * u }}>
          <View className="flex-1 overflow-hidden rounded-full">{card.photo ? <Photo url={card.photo.url} /> : null}</View>
        </View>
      </View>
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: badge + 10 * u,
          height: badge + 10 * u,
          marginTop: -(badge / 2 + 5 * u) - 4 * u,
          backgroundColor: jade[950],
        }}
      >
        <View className="items-center justify-center overflow-hidden rounded-full" style={{ width: badge, height: badge }}>
          <Svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%" viewBox="0 0 1 1">
            <Defs>
              <LinearGradient id={`badge${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
                <Stop offset="0" stopColor={shoot[50]} />
                <Stop offset="0.55" stopColor={shoot[300]} />
                <Stop offset="1" stopColor={BC.badgeShade} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill={`url(#badge${id})`} />
          </Svg>
          <T u={u} size={40} className="font-rounded font-extrabold tabular-nums" style={{ color: shoot[950] }}>
            {card.age}
          </T>
        </View>
      </View>
      <View className="items-center" style={{ marginTop: 14 * u, paddingHorizontal: 22 * u }}>
        <T u={u} size={30} lines={1} className="text-center font-bold" style={{ color: WHITE }}>
          {`${card.name} ${card.age} 岁了`}
        </T>
        <T u={u} size={14} lines={1} className="text-center" style={{ color: WHITE, opacity: 0.7, marginTop: 6 * u }}>
          {card.nameEn ? `生日快乐，${card.nameEn}` : "生日快乐"}
        </T>
        <T u={u} size={12} className="font-rounded font-semibold tabular-nums" style={{ color: shoot[300], marginTop: 14 * u }}>
          {`${dotted(card.birthDate)} — ${dotted(card.date)}`}
        </T>
      </View>
      <View
        className="absolute flex-row items-center justify-between"
        style={{ bottom: 18 * u, left: 22 * u, right: 22 * u, gap: 12 * u }}
      >
        <T u={u} size={13} className="font-bold" style={{ color: WHITE }}>
          吱熊猫
        </T>
        {card.photo?.credit ? (
          <T u={u} size={11} lines={2} className="shrink text-right" style={{ color: WHITE, opacity: 0.5 }}>
            {card.photo.credit}
          </T>
        ) : null}
      </View>
    </View>
  );
}

/** C 园区海报: a striped 笋金 frame, the photo inset, a tab with the name and age, the days left in jade. */
function Poster({ card, u }: { card: BirthdayCardData; u: number }) {
  const id = useId().replaceAll(":", "");
  const count = 74 * u;
  const weekday = dayHeading(card.date).split(" ")[1] ?? "";
  const [, m, d] = card.date.split("-");
  return (
    <View className="absolute inset-0">
      <Svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%">
        <Defs>
          <Pattern id={`stripe${id}`} width={28 * u} height={28 * u} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect x="0" y="0" width={14 * u} height={28 * u} fill={shoot[50]} />
            <Rect x={14 * u} y="0" width={14 * u} height={28 * u} fill={BC.stripe} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#stripe${id})`} />
      </Svg>
      <View className="absolute overflow-hidden" style={{ top: 16 * u, left: 16 * u, right: 16 * u, height: 330 * u, borderRadius: 22 * u, backgroundColor: gray[700] }}>
        {card.photo ? <Photo url={card.photo.url} /> : null}
      </View>
      <View
        className="absolute items-center justify-center rounded-full"
        style={{ top: 26 * u, right: 26 * u, width: count + 8 * u, height: count + 8 * u, backgroundColor: shoot[50] }}
      >
        <View className="items-center justify-center rounded-full" style={{ width: count, height: count, backgroundColor: jade[700] }}>
          {card.inDays === 0 ? (
            <T u={u} size={20} className="font-bold" style={{ color: WHITE }}>
              今天
            </T>
          ) : (
            <>
              <T u={u} size={11} className="font-semibold" style={{ color: WHITE, opacity: 0.85 }}>
                还有
              </T>
              <T u={u} size={26} className="font-rounded font-extrabold tabular-nums" style={{ color: WHITE, lineHeight: 28 * u }}>
                {card.inDays}
              </T>
              <T u={u} size={11} className="font-semibold" style={{ color: WHITE, opacity: 0.85 }}>
                天
              </T>
            </>
          )}
        </View>
      </View>
      <View className="absolute" style={{ left: 16 * u, bottom: 16 * u, width: 250 * u }}>
        <View
          className="self-start justify-center"
          style={{ backgroundColor: WHITE, height: 31 * u, marginBottom: -1, paddingHorizontal: 18 * u, borderTopLeftRadius: 18 * u, borderTopRightRadius: 18 * u }}
        >
          <T u={u} size={13} lines={1} className="font-rounded font-extrabold" style={{ color: jade[700] }}>
            {`${(card.nameEn ?? card.name).toUpperCase()} ${ordinal(card.age)}`}
          </T>
        </View>
        <View
          style={{
            backgroundColor: WHITE,
            paddingHorizontal: 18 * u,
            paddingTop: 12 * u,
            paddingBottom: 14 * u,
            borderTopRightRadius: 26 * u,
            borderBottomLeftRadius: 22 * u,
            borderBottomRightRadius: 22 * u,
          }}
        >
          <T u={u} size={30} lines={1} className="font-bold" style={{ color: gray.black }}>
            {`${card.name} `}
            <Text allowFontScaling={false} className="font-rounded tabular-nums" style={{ color: shoot[700] }}>
              {card.age}
            </Text>
            {" 岁"}
          </T>
          <T u={u} size={12} lines={2} style={{ color: gray[500], marginTop: 4 * u }}>
            {["生日快乐", card.photo?.credit].filter(Boolean).join(" · ")}
          </T>
        </View>
      </View>
      <View className="absolute items-end" style={{ right: 16 * u, bottom: 22 * u }}>
        <T u={u} size={20} className="font-rounded font-bold tabular-nums" style={{ color: jade[700] }}>
          {`${Number(m)}.${Number(d)}`}
        </T>
        <T u={u} size={11} style={{ color: shoot[950] }}>
          {weekday}
        </T>
      </View>
    </View>
  );
}

/** The 生日卡 a fan shares, in one of three looks. The view behind `cardRef` is what becomes the PNG. */
export function BirthdayCard({
  card,
  look,
  cardRef,
}: {
  card: BirthdayCardData;
  look: BirthdayCardStyle;
  cardRef: RefObject<ComponentRef<typeof View> | null>;
}) {
  const [width, setWidth] = useState(0);
  const u = width / ARTBOARD;
  return (
    <View
      ref={cardRef}
      collapsable={false}
      accessible
      role="img"
      accessibilityLabel={birthdayCardLabel(card)}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      className="w-full self-center overflow-hidden"
      style={{ maxWidth: ARTBOARD, aspectRatio: BC.artboard.width / BC.artboard.height, borderRadius: BC.radius * (u || 1), borderCurve: "continuous", backgroundColor: jade[950] }}
    >
      {width > 0 ? (
        look === "medal" ? <Medal card={card} u={u} /> : look === "poster" ? <Poster card={card} u={u} /> : <Cover card={card} u={u} />
      ) : null}
    </View>
  );
}
