import { Redirect } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Uniwind } from "uniwind";

import { SwitchRow } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { ChevronRight, Sun } from "@/components/icons";
import { Page } from "@/components/page";
import { PressScale } from "@/components/press-scale";
import { Text } from "@/components/ui/text";
import { CONTENT_ENTER, EASE_OUT, SPRING_BAMBOO } from "@/design/motion";
import {
  type ColorRole,
  colorRoleNotes,
  component,
  concentric,
  primitive,
  semantic,
  type TextStyle,
} from "@/design/tokens";
import { useIOSColors } from "@/lib/theme";

/**
 * The design-system showcase: every token rendered from src/design/tokens.ts, in both appearances.
 * Development builds only. Nothing in the app links here; open /dev/design-system by URL.
 */
export default function DesignSystemRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DesignSystemShowcase />;
}

const SCHEMES = ["light", "dark"] as const;

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View className="gap-row">
      <View className="gap-hair-gap">
        <Text variant="title">{title}</Text>
        {note ? <Text variant="footnote" className="text-muted-foreground">{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`gap-row rounded-tile bg-card p-inset ${className ?? ""}`} style={{ borderCurve: "continuous" }}>
      {children}
    </View>
  );
}

/** SwitchRow: the whole row is the switch; the track is component.switchTrack. */
function SwitchRowDemo() {
  const [on, setOn] = useState(true);
  return (
    <View className="overflow-hidden rounded-group bg-background">
      <SwitchRow
        label={`开关行 ${component.switchTrack.width}×${component.switchTrack.height}`}
        value={on}
        onChange={setOn}
      />
    </View>
  );
}

function AppearanceSwitch() {
  const { scheme } = useIOSColors();
  return (
    <View className="flex-row gap-stack-tight">
      {(["light", "dark", "system"] as const).map((choice) => (
        <Pressable
          key={choice}
          role="button"
          onPress={() => Uniwind.setTheme(choice)}
          className="items-center justify-center rounded-pill bg-secondary px-inset active:bg-accent"
          style={{ minHeight: component.hitTarget }}
        >
          <Text variant="headline">{{ light: "浅色", dark: "深色", system: "跟随系统" }[choice]}</Text>
        </Pressable>
      ))}
      <View className="justify-center">
        <Text variant="footnote" className="text-muted-foreground">现在：{scheme}</Text>
      </View>
    </View>
  );
}

function Swatch({ role }: { role: ColorRole }) {
  return (
    <View className="flex-row items-center gap-row">
      <View className="flex-row overflow-hidden rounded-control">
        {SCHEMES.map((scheme) => (
          <View
            key={scheme}
            style={{ width: 44, height: 44, backgroundColor: semantic.color[scheme].groupedBackground, padding: 6 }}
          >
            <View
              style={{
                flex: 1,
                borderRadius: concentric(semantic.radius.control.value, 6),
                backgroundColor: semantic.color[scheme][role],
                borderWidth: 1,
                borderColor: semantic.color[scheme].photoStroke,
              }}
            />
          </View>
        ))}
      </View>
      <View className="flex-1 gap-hair-gap">
        <Text variant="headline">{role}</Text>
        <Text variant="footnote" className="text-muted-foreground">
          {semantic.color.light[role]} · {semantic.color.dark[role]}
        </Text>
        <Text variant="footnote" className="text-muted-foreground">{colorRoleNotes[role]}</Text>
      </View>
    </View>
  );
}

function WarmDemo() {
  return (
    <Card>
      <Text variant="footnote" className="text-muted-foreground">笋金只做标记：今天、新、里程碑。不做按钮、链接或卡片底色。</Text>
      <View className="flex-row flex-wrap items-center gap-stack-tight">
        <View className="rounded-pill bg-warm-soft px-stack-tight py-hair-gap">
          <Text variant="footnote" className="font-semibold text-warm">今天</Text>
        </View>
        <View className="rounded-pill bg-warm-soft px-stack-tight py-hair-gap">
          <Text variant="footnote" className="font-semibold text-warm">新成员</Text>
        </View>
        <View className="flex-row items-center gap-hair-gap">
          <View className="rounded-pill bg-warm" style={{ width: 8, height: 8 }} />
          <Text variant="footnote" className="text-warm">10 月 29 日 · 今天</Text>
        </View>
      </View>
    </Card>
  );
}

function spec(style: Pick<TextStyle, "size" | "lineHeight" | "weight">) {
  const weight = { "400": "Regular", "600": "Semibold", "700": "Bold" }[style.weight];
  return `${style.size}/${style.lineHeight} ${weight}`;
}

const SAMPLE: Record<string, string> = {
  display: "和花",
  title: "成都大熊猫繁育研究基地",
  headline: "福宝 · 雌",
  body: "大熊猫每天要花十多个小时进食，吃掉 12–38 公斤竹子。",
  subheadline: "和叶 的妹妹 · 2020 年出生",
  footnote: "2026 年 10 月 29 日 · 摄影 张浩",
};

function TypeScale() {
  return (
    <Card>
      {(Object.entries(semantic.text) as [keyof typeof semantic.text, TextStyle][]).map(([name, style]) => (
        <View key={name} className="gap-hair-gap">
          <Text variant="footnote" className="text-muted-foreground">
            {name} · {spec(style)}
          </Text>
          <Text variant={name}>{SAMPLE[name]}</Text>
        </View>
      ))}
      <View className="gap-hair-gap">
        <Text variant="footnote" className="text-muted-foreground">stat · title + tabular-nums</Text>
        <Text variant="stat">1,864 只</Text>
      </View>
    </Card>
  );
}

function ReadingSample() {
  return (
    <View className="gap-stack-tight rounded-tile bg-paper p-inset" style={{ borderCurve: "continuous" }}>
      <Text variant="footnote" className="text-muted-foreground">
        readingTitle {spec(semantic.reading["reading-title"])} · readingBody {spec(semantic.reading["reading-body"])}
      </Text>
      <Text variant="readingTitle">大熊猫为什么吃竹子</Text>
      <Text variant="readingLead">它们是食肉目动物，却把一生交给了竹林。</Text>
      <Text variant="readingHeading">伪拇指</Text>
      <Text variant="readingBody">
        大熊猫的腕骨上长出一块增大的籽骨，像第六根手指，可以和其余五指相对，牢牢握住竹竿。这块骨头在约 600
        万年前就已出现。
      </Text>
      <Text variant="readingCaption">图：卧龙中华大熊猫苑 · 2024</Text>
    </View>
  );
}

function SpacingScale() {
  const { tint } = useIOSColors();
  return (
    <Card>
      {Object.entries(semantic.spacing).map(([name, { value, use }]) => (
        <View key={name} className="gap-hair-gap">
          <View className="flex-row items-center gap-row">
            <View style={{ width: value * 4, height: 12, backgroundColor: tint, borderRadius: 2 }} />
            <Text variant="headline">
              {name} · {value}
            </Text>
          </View>
          <Text variant="footnote" className="text-muted-foreground">{use}</Text>
        </View>
      ))}
      <Text variant="footnote" className="text-muted-foreground">
        4pt 刻度：{Object.values(primitive.space).filter(Boolean).join(" / ")}
      </Text>
    </Card>
  );
}

function Radii() {
  const { fill, card } = useIOSColors();
  return (
    <Card>
      <View className="flex-row flex-wrap gap-row">
        {Object.entries(semantic.radius).map(([name, { value }]) => (
          <View key={name} className="items-center gap-hair-gap">
            <View style={{ width: 72, height: 56, borderRadius: Math.min(value, 28), backgroundColor: fill, borderCurve: "continuous" }} />
            <Text variant="footnote">
              {name} {value}
            </Text>
          </View>
        ))}
      </View>
      <View className="gap-hair-gap">
        <Text variant="footnote" className="text-muted-foreground">同心圆角：tile 16 − padding 12 = 内层 4</Text>
        <View style={{ borderRadius: semantic.radius.tile.value, padding: 12, backgroundColor: fill, borderCurve: "continuous" }}>
          <View style={{ height: 40, borderRadius: concentric(semantic.radius.tile.value, 12), backgroundColor: card }} />
        </View>
      </View>
    </Card>
  );
}

function MotionDemo() {
  const reduced = useReducedMotion();
  const [replay, setReplay] = useState(0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const bamboo = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const plain = useAnimatedStyle(() => ({ transform: [{ translateX: y.get() }] }));
  const { tint, warm } = useIOSColors();
  const go = () => {
    const to = x.get() === 0 ? 200 : 0;
    x.set(withSpring(to, SPRING_BAMBOO));
    y.set(withTiming(to, { duration: semantic.motion.move.duration, easing: EASE_OUT }));
  };
  return (
    <Card>
      <Text variant="footnote" className="text-muted-foreground">
        减弱动态效果：{reduced ? "开（只淡入、按下变暗）" : "关"}
      </Text>
      {Object.entries(semantic.motion).map(([name, role]) => (
        <Text key={name} variant="footnote">
          <Text variant="footnote" className="font-semibold">{name}</Text> · {role.duration}ms · {role.easing} — {role.use}
        </Text>
      ))}
      <Text variant="footnote" className="text-muted-foreground">
        竹 bamboo：spring mass {primitive.spring.bamboo.mass} / stiffness {primitive.spring.bamboo.stiffness} / damping{" "}
        {primitive.spring.bamboo.damping} · cubic-bezier({primitive.easing.bamboo.join(", ")})
      </Text>
      <Pressable role="button" onPress={go} className="gap-stack-tight py-hair-gap">
        <Animated.View style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: warm }, bamboo]} />
        <Animated.View style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: tint }, plain]} />
        <Text variant="footnote" className="text-muted-foreground">点一下：上 = bamboo 弹簧，下 = ease-out 280ms</Text>
      </Pressable>
      <View className="flex-row gap-row">
        <PressScale containerStyle={{ flex: 1 }} className="items-center justify-center rounded-tile bg-secondary" style={{ height: 72 }}>
          <Text variant="headline">按住我 · press</Text>
        </PressScale>
        <Pressable role="button" onPress={() => setReplay((n) => n + 1)} className="flex-1 items-center justify-center rounded-tile bg-secondary">
          <Text variant="headline">重播 enter</Text>
        </Pressable>
      </View>
      <Animated.View key={replay} entering={CONTENT_ENTER} className="rounded-tile bg-highlight-soft p-inset">
        <Text variant="headline" className="text-primary">内容进入：淡入 + 上移 8pt，bamboo 曲线</Text>
      </Animated.View>
    </Card>
  );
}

function Sizes() {
  return (
    <Card>
      <View className="flex-row items-end gap-stack">
        {(["footnote", "subhead", "body", "title3"] as const).map((size) => (
          <View key={size} className="items-center gap-hair-gap">
            <Icon icon={Sun} size={size} />
            <Text variant="footnote">
              {size} {component.icon[size]}
            </Text>
          </View>
        ))}
        <View className="items-center gap-hair-gap">
          <Icon icon={ChevronRight} size={component.icon.chevron} tone="tertiary" strokeWidth={component.iconStroke.bold} />
          <Text variant="footnote">chevron {component.icon.chevron}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-row">
        <View
          className="items-center justify-center rounded-control border border-dashed border-border"
          style={{ width: component.hitTarget, height: component.hitTarget }}
        >
          <Icon icon={Sun} size="footnote" />
        </View>
        <Text variant="footnote" className="flex-1 text-muted-foreground">
          最小点击区域 {component.hitTarget}×{component.hitTarget}；按钮高 {component.button.height}；列表行至少{" "}
          {component.listRow.minHeight}
        </Text>
      </View>
      <SwitchRowDemo />
    </Card>
  );
}

function DesignSystemShowcase() {
  return (
    <Page title="设计系统" label="开发专用 · 数据来自 src/design/tokens.ts" prominent>
      <AppearanceSwitch />
      <Section title="颜色" note="左：浅色，右：深色。语义角色，不直接用原色。">
        <Card>
          {(Object.keys(semantic.color.light) as ColorRole[]).map((role) => (
            <Swatch key={role} role={role} />
          ))}
        </Card>
      </Section>
      <Section title="笋金 · 暖色点缀" note="浅色 #846018（白底 5.7:1），深色 #E3BD6E（黑底 11.8:1）">
        <WarmDemo />
      </Section>
      <Section title="文字样式" note="按用途命名，每个样式绑定字号、行高、字重；中文不加字距。">
        <TypeScale />
      </Section>
      <Section title="科普阅读" note="只用于科普文章栏。">
        <ReadingSample />
      </Section>
      <Section title="间距" note="4pt 刻度上的语义名：p-inset、gap-row、gap-section…">
        <SpacingScale />
      </Section>
      <Section title="圆角">
        <Radii />
      </Section>
      <Section title="动效">
        <MotionDemo />
      </Section>
      <Section title="尺寸">
        <Sizes />
      </Section>
    </Page>
  );
}
