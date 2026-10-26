import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type Family, loadFamily, memberMeta, relativesOf } from "@/features/family/family";
import { FamilyTree, MemberAvatar, openFamily } from "@/features/family/family-tree";
import { cn } from "@/lib/utils";

export default function FamilyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [family, setFamily] = useState<Family | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadFamily(slug)
      .then(setFamily)
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  if (!family) {
    return (
      <Page label="家谱" title="家族">
        {failed ? (
          <View className="items-start gap-3 rounded-lg bg-muted p-5">
            <Text>家谱暂时打不开。</Text>
            <Button onPress={retry}>
              <Text>重试</Text>
            </Button>
          </View>
        ) : (
          <Skeleton className="h-96 w-full rounded-xl" accessibilityLabel="正在加载家谱" />
        )}
      </Page>
    );
  }

  const relatives = relativesOf(family);

  return (
    <Page label="家谱" title={`${family.focus.name}的家族`}>
      <FamilyTree family={family} />

      <View>
        <Text variant="h2" className="mb-2">
          家人
        </Text>
        {relatives.length === 0 ? (
          <View className="rounded-lg bg-muted p-4">
            <Text className="text-muted-foreground">暂无家人记录</Text>
          </View>
        ) : (
          relatives.map((member, index) => (
            <Pressable
              key={member.id}
              onPress={() => openFamily(member)}
              role="button"
              accessibilityLabel={`${member.name}，${memberMeta(member)}`}
              className={cn(
                "flex-row items-center gap-3 border-t-hairline border-border py-2.5 active:bg-accent",
                index === relatives.length - 1 && "border-b-hairline",
              )}
            >
              <MemberAvatar member={member} />
              <View className="min-w-0 flex-1">
                <Text className="font-bold">{member.name}</Text>
                <Text variant="muted" numberOfLines={1}>
                  {memberMeta(member)}
                </Text>
              </View>
              <Text className="text-muted-foreground">›</Text>
            </Pressable>
          ))
        )}
      </View>
    </Page>
  );
}
