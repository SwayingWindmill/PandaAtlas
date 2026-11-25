import { useLocalSearchParams } from "expo-router";

import { Page } from "@/components/page";
import { RelationshipContent } from "@/features/relationship/relationship-content";

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function RelationshipScreen() {
  const { from, to, a, b } = useLocalSearchParams<{ from?: string; to?: string; a?: string; b?: string }>();
  const initialFrom = param(from) ?? param(a);
  const initialTo = param(to) ?? param(b);
  return (
    <Page label="选两只熊猫，按公开的谱系找出它们的关系。" title="查关系" keyboardShouldPersistTaps="handled">
      <RelationshipContent from={initialFrom} to={initialTo} />
    </Page>
  );
}
