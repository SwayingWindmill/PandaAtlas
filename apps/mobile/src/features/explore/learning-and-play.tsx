import { View } from "react-native";

import { ListCell, ListSection } from "@/components/grouped-list";
import { FileText } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { RemoteImage } from "@/components/remote-image";
import { SectionHeader } from "@/components/section-header";
import { articleHero, learningText, readingMinutes } from "@/features/learning/catalog";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";
import { RADIUS } from "@/lib/surface";

const THUMB_SIZE = 44;

export function LearningAndPlaySection() {
  const { state } = useLearningCatalog();
  const { pandas } = useLearningPandas();
  const articles = state.status === "ready" ? state.catalog.articles : [];
  const faceGuides = state.status === "ready" ? state.catalog.faceGuides : [];

  const leadArticle = articles[0];
  const leadGuide = faceGuides[0];
  const action =
    articles.length > 0
      ? { label: `全部 ${articles.length} 篇`, href: "/learn" as const, accessibilityLabel: `查看全部 ${articles.length} 篇科普` }
      : { label: "全部", href: "/learn" as const, accessibilityLabel: "查看认识大熊猫科普" };

  if (state.status === "ready" && !leadArticle && !leadGuide) return null;

  const hero = leadArticle ? articleHero(leadArticle) : undefined;
  const guidePanda = leadGuide && pandas ? pandas.find((item) => item.slug === leadGuide.pandaSlug) : undefined;

  return (
    <View className="gap-stack-tight">
      <SectionHeader title="认识大熊猫" action={action} />
      {leadArticle || leadGuide ? (
        <ListSection>
          {leadArticle ? (
            <ListCell
              icon={hero?.asset ? undefined : FileText}
              label={learningText(leadArticle.title)}
              detail={[leadArticle.category, `约 ${readingMinutes(leadArticle)} 分钟`].filter(Boolean).join("　")}
              lines={2}
              href={{ pathname: "/learn/articles/[slug]", params: { slug: leadArticle.slug } }}
              role="link"
              trailing={
                hero?.asset ? (
                  <View
                    className="overflow-hidden rounded-control bg-secondary"
                    style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderCurve: "continuous" }}
                  >
                    <RemoteImage
                      source={hero.asset}
                      style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                      contentFit="cover"
                      accessible={false}
                    />
                    <PhotoOutline radius={RADIUS.control} />
                  </View>
                ) : undefined
              }
              last={!leadGuide}
            />
          ) : null}
          {leadGuide ? (
            <ListCell
              label="怎么认出是哪只熊猫？"
              detail="认脸指南　脸型、眼斑与特征图解"
              lines={1}
              href={{ pathname: "/learn/faces/[slug]", params: { slug: leadGuide.slug } }}
              role="link"
              trailing={
                guidePanda ? (
                  <PandaThumb pandaId={guidePanda.id} name={guidePanda.name} size={THUMB_SIZE} shape="tile" />
                ) : undefined
              }
              last
            />
          ) : null}
        </ListSection>
      ) : null}
    </View>
  );
}
