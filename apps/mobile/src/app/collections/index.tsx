import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import {
  type Collection,
  NAME_MAX,
  collectionName,
  createCollection,
  loadCollections,
} from "@/features/collections/collections";
import { cn } from "@/lib/utils";

function NewCollection({ onCreated }: { onCreated: (collection: Collection) => void }) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");

  async function create() {
    const valid = collectionName(name);
    if (!valid) return;
    setStatus("saving");
    try {
      onCreated(await createCollection(valid));
      setName("");
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <View className="gap-2">
      <View className="gap-2">
        <TextInput
          value={name}
          onChangeText={(value) => setName(value.slice(0, NAME_MAX))}
          placeholder="新合集的名字"
          placeholderTextColor={muted}
          accessibilityLabel="新合集的名字"
          className="h-12 rounded-full border-hairline border-input px-5 text-base text-foreground"
        />
        <Button
          className="self-start"
          onPress={() => void create()}
          disabled={!collectionName(name) || status === "saving"}
        >
          <Text>新建</Text>
        </Button>
      </View>
      {status === "failed" ? <Text className="text-destructive">没能新建，请再试一次。</Text> : null}
    </View>
  );
}

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadCollections()
      .then((loaded) => {
        setCollections(loaded);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);
  useFocusEffect(load);

  return (
    <Page label="我的" title="我的合集" keyboardShouldPersistTaps="handled">
      {failed ? (
        <LoadFailed message="合集暂时打不开。" onRetry={load} />
      ) : collections === null ? (
        <Skeleton className="h-40 w-full" accessibilityLabel="正在加载合集" />
      ) : (
        <>
          <NewCollection onCreated={(created) => setCollections((current) => [created, ...(current ?? [])])} />
          {collections.length === 0 ? (
            <Text className="text-muted-foreground">还没有合集。起个名字，把喜欢的熊猫放在一起。</Text>
          ) : (
            <View>
              {collections.map((collection, index) => (
                <Pressable
                  key={collection.collectionId}
                  onPress={() =>
                    router.push({ pathname: "/collections/[id]", params: { id: collection.collectionId } })
                  }
                  role="button"
                  accessibilityLabel={`${collection.name}，${collection.pandaIds.length} 只`}
                  className={cn(
                    "flex-row items-center justify-between gap-3 border-t-hairline border-border py-3.5 active:bg-accent",
                    index === collections.length - 1 && "border-b-hairline",
                  )}
                >
                  <Text className="min-w-0 flex-1 font-bold" numberOfLines={1}>
                    {collection.name}
                  </Text>
                  <Text variant="muted">{`${collection.pandaIds.length} 只`}</Text>
                  <Text className="text-muted-foreground">›</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </Page>
  );
}
