import { ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Eye, FileText, Trophy } from "@/components/icons";
import { SectionHeader } from "@/components/section-header";
import { learningText } from "@/features/learning/catalog";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { View } from "react-native";

export function LearningAndPlaySection() {
  const { state } = useLearningCatalog();
  const articles = state.status === "ready" ? state.catalog.articles : [];
  const faceGuides = state.status === "ready" ? state.catalog.faceGuides : [];

  const leadArticle = articles[0];
  const leadGuide = faceGuides[0];
  const action =
    articles.length > 0
      ? { label: `全部 ${articles.length} 篇`, href: "/learn" as const, accessibilityLabel: `查看全部 ${articles.length} 篇科普` }
      : { label: "全部", href: "/learn" as const, accessibilityLabel: "查看认识大熊猫科普" };

  return (
    <View className="gap-stack-tight">
      <SectionHeader title="科普与趣味" action={action} />
      <ListSection>
        {leadArticle ? (
          <ListCell
            icon={FileText}
            label={learningText(leadArticle.title)}
            detail={[leadArticle.category, learningText(leadArticle.dek)].filter(Boolean).join("　")}
            lines={1}
            href={{ pathname: "/learn/articles/[slug]", params: { slug: leadArticle.slug } }}
            role="link"
          />
        ) : null}
        {leadGuide ? (
          <ListCell
            icon={Eye}
            label="怎么认出是哪只熊猫？"
            detail="认脸指南　脸型、眼斑与“雷达耳”图解"
            lines={1}
            href={{ pathname: "/learn/faces/[slug]", params: { slug: leadGuide.slug } }}
            role="link"
          />
        ) : null}
        <ListCell
          leading={<Icon icon={Trophy} size="body" tone="tint" />}
          label="趣味挑战"
          detail="每日一猫　猜熊猫　认脸挑战　月度挑战"
          lines={1}
          href="/play"
          role="link"
          last
        />
      </ListSection>
    </View>
  );
}
