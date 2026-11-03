import { useLocalSearchParams } from "expo-router";

import { Page } from "@/components/page";
import { RelationshipContent } from "@/features/relationship/relationship-content";

export default function RelationshipScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return (
    <Page label="选两只熊猫，按公开的谱系找出它们的关系。" title="查关系" keyboardShouldPersistTaps="handled">
      <RelationshipContent from={from} />
    </Page>
  );
}
