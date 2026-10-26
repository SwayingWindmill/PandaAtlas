import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { TextInput, View } from "react-native";
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
  deleteCollection,
  loadCollections,
  renameCollection,
  setInCollection,
} from "@/features/collections/collections";
import { PandaRow } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";

function Rename({ collection, onRenamed }: { collection: Collection; onRenamed: (next: Collection) => void }) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  const [name, setName] = useState(collection.name);
  const [failed, setFailed] = useState(false);

  async function save() {
    const valid = collectionName(name);
    if (!valid) return;
    try {
      onRenamed(await renameCollection(collection.collectionId, valid));
    } catch {
      setFailed(true);
    }
  }

  return (
    <View className="gap-2">
      <TextInput
        value={name}
        onChangeText={(value) => setName(value.slice(0, NAME_MAX))}
        placeholderTextColor={muted}
        accessibilityLabel="合集名字"
        autoFocus
        className="h-12 rounded-full border-hairline border-input px-5 text-base text-foreground"
      />
      <Button className="self-start" onPress={() => void save()} disabled={!collectionName(name)}>
        <Text>保存</Text>
      </Button>
      {failed ? <Text className="text-destructive">没能改名，请再试一次。</Text> : null}
    </View>
  );
}

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [pandas, setPandas] = useState<Map<string, PandaListItem>>(new Map());
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<"view" | "rename" | "confirmDelete">("view");
  const [actionFailed, setActionFailed] = useState(false);

  const load = useCallback(() => {
    Promise.all([loadCollections(), loadPandaIndex()])
      .then(([collections, index]) => {
        setPandas(new Map(index.map((panda) => [panda.id, panda])));
        const found = collections.find((item) => item.collectionId === id);
        if (found) setCollection(found);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [id]);
  useEffect(load, [load]);

  async function remove(pandaId: string) {
    if (!collection) return;
    setActionFailed(false);
    try {
      setCollection(await setInCollection(collection.collectionId, pandaId, false));
    } catch {
      setActionFailed(true);
    }
  }

  async function destroy() {
    if (!collection) return;
    setActionFailed(false);
    try {
      await deleteCollection(collection.collectionId);
      router.back();
    } catch {
      setActionFailed(true);
    }
  }

  if (!collection) {
    return (
      <Page label="我的合集" title="合集">
        {failed ? (
          <LoadFailed
            message="这个合集暂时打不开。"
            onRetry={() => {
              setFailed(false);
              load();
            }}
          />
        ) : (
          <Skeleton className="h-40 w-full" accessibilityLabel="正在加载合集" />
        )}
      </Page>
    );
  }

  const members = collection.pandaIds.flatMap((pandaId) => pandas.get(pandaId) ?? []);
  return (
    <Page label="我的合集" title={collection.name} keyboardShouldPersistTaps="handled">
      {mode === "rename" ? (
        <Rename
          collection={collection}
          onRenamed={(next) => {
            setCollection(next);
            setMode("view");
          }}
        />
      ) : null}
      {members.length === 0 ? (
        <Text className="text-muted-foreground">还是空的。在熊猫资料页点「加入合集」。</Text>
      ) : (
        <View>
          {members.map((panda, index) => (
            <View key={panda.id} className="flex-row items-center gap-2">
              <View className="min-w-0 flex-1">
                <PandaRow item={panda} last={index === members.length - 1} />
              </View>
              <Button
                variant="secondary"
                onPress={() => void remove(panda.id)}
                accessibilityLabel={`把${panda.name}移出合集`}
              >
                <Text>移出</Text>
              </Button>
            </View>
          ))}
        </View>
      )}
      {actionFailed ? <Text className="text-destructive">没能完成，请再试一次。</Text> : null}
      {mode === "confirmDelete" ? (
        <View className="w-full gap-3 rounded-lg border-hairline border-destructive p-4">
          <Text className="font-bold">{`删除「${collection.name}」？`}</Text>
          <Text className="text-muted-foreground">合集里的熊猫不会受影响。</Text>
          <View className="flex-row flex-wrap gap-2">
            <Button variant="destructive" onPress={() => void destroy()}>
              <Text>删除</Text>
            </Button>
            <Button variant="secondary" onPress={() => setMode("view")}>
              <Text>取消</Text>
            </Button>
          </View>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2 border-t-hairline border-border pt-4">
          <Button variant="secondary" onPress={() => setMode(mode === "rename" ? "view" : "rename")}>
            <Text>{mode === "rename" ? "取消改名" : "改名字"}</Text>
          </Button>
          <Button variant="outline" onPress={() => setMode("confirmDelete")}>
            <Text>删除合集</Text>
          </Button>
        </View>
      )}
    </Page>
  );
}
