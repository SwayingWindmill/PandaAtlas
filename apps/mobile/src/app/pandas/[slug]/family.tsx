import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type Family, type FamilyMember, loadFamily, memberMeta } from "@/features/family/family";
import { FamilyTree, MemberAvatar, openFamily } from "@/features/family/family-tree";

function relativesOf(family: Family): FamilyMember[] {
  return [
    family.father,
    family.mother,
    ...family.generation.flatMap((group) => group.members).filter((member) => member.id !== family.focus.id),
    ...family.children,
  ].filter((member): member is FamilyMember => member !== null);
}

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
      <View className="flex-1 gap-5 bg-background px-5 pt-6">
        {failed ? (
          <View className="items-start gap-3 rounded-lg bg-muted p-5">
            <Text>这只熊猫的家谱暂时打不开。</Text>
            <Button onPress={retry}>
              <Text>重试</Text>
            </Button>
          </View>
        ) : (
          <View className="gap-5" accessibilityLabel="正在加载家谱">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </View>
        )}
      </View>
    );
  }

  const relatives = relativesOf(family);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 px-5 pb-12 pt-6">
      <Text variant="h1">{family.focus.name}的家族</Text>

      <View className="gap-2">
        <FamilyTree family={family} />
        {relatives.length > 0 ? (
          <Text variant="muted" className="self-end">
            点一只熊猫，以它为中心
          </Text>
        ) : null}
      </View>

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
              className={
                index === relatives.length - 1
                  ? "flex-row items-center gap-3 border-t-hairline border-b-hairline border-border py-2.5 active:bg-accent"
                  : "flex-row items-center gap-3 border-t-hairline border-border py-2.5 active:bg-accent"
              }
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
    </ScrollView>
  );
}
