import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { ListCell, ListSection } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { type InstitutionListItem, loadInstitutions } from "@/features/institutions/institutions";

function Group({ title, items }: { title: string; items: InstitutionListItem[] }) {
  if (items.length === 0) return null;
  return (
    <ListSection title={title}>
      {items.map((item, index) => (
        <ListCell
          key={item.slug}
          label={item.name}
          detail={item.meta}
          href={{ pathname: "/institutions/[slug]", params: { slug: item.slug } }}
          last={index === items.length - 1}
          accessibilityLabel={`${item.name}，${item.meta}`}
        />
      ))}
    </ListSection>
  );
}

export default function InstitutionsScreen() {
  const [items, setItems] = useState<InstitutionListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadInstitutions()
      .then(setItems)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  return (
    <Page title="基地和动物园">
      {items ? (
        <>
          <Group title="国内" items={items.filter((item) => item.domestic)} />
          <Group title="海外" items={items.filter((item) => !item.domestic)} />
        </>
      ) : failed ? (
        <LoadFailed message="列表暂时打不开。" onRetry={retry} />
      ) : (
        <View className="gap-3" accessibilityLabel="正在加载">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </View>
      )}
    </Page>
  );
}
