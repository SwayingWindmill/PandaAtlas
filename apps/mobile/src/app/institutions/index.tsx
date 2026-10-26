import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type InstitutionListItem, loadInstitutions } from "@/features/institutions/institutions";
import { cn } from "@/lib/utils";

function Group({ title, items }: { title: string; items: InstitutionListItem[] }) {
  if (items.length === 0) return null;
  return (
    <View className="gap-2">
      <Text variant="small" className="text-muted-foreground">
        {title}
      </Text>
      <View>
        {items.map((item, index) => (
          <Pressable
            key={item.slug}
            onPress={() => router.push({ pathname: "/institutions/[slug]", params: { slug: item.slug } })}
            role="button"
            accessibilityLabel={`${item.name}，${item.meta}`}
            className={cn(
              "flex-row items-center gap-3 border-t-hairline border-border py-3 active:bg-accent",
              index === items.length - 1 && "border-b-hairline",
            )}
          >
            <View className="min-w-0 flex-1">
              <Text className="font-bold">{item.name}</Text>
              <Text variant="muted">{item.meta}</Text>
            </View>
            <Text className="text-muted-foreground">›</Text>
          </Pressable>
        ))}
      </View>
    </View>
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
