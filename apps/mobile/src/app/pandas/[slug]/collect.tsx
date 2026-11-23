import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { Toggle } from "@/components/ui/toggle";
import {
  type Collection,
  NAME_MAX,
  collectionName,
  createCollection,
  collectionsQueryOptions,
  patchCollections,
  setInCollection,
} from "@/features/collections/collections";
import { correctionTargetQueryOptions } from "@/features/corrections/submissions";
import {
  createGuestCollection,
  guestCollectionsQueryOptions,
  setInGuestCollection,
} from "@/features/engagement/guest-store";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { useAccount } from "@/features/session/account";
import { useSession } from "@/features/session/session";
import { failedWithoutData } from "@/lib/query-failed";

/** Which of the fan's collections hold this panda; a tap adds or removes it. */
export default function CollectScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { state: session } = useSession();
  const muted = String(useCSSVariable("--color-muted-foreground"));
  const { accountId } = useAccount();
  const signedIn = accountId !== null;
  const signedOut = session.status === "signedOut";
  const [name, setName] = useState("");
  const [actionFailed, setActionFailed] = useState(false);

  const target = useQuery({ ...correctionTargetQueryOptions(slug), enabled: signedIn });
  const publicIndex = useQuery({ ...pandaIndexQueryOptions(), enabled: signedOut });
  const remoteList = useQuery({ ...collectionsQueryOptions(accountId ?? ""), enabled: signedIn });
  const guestList = useQuery({ ...guestCollectionsQueryOptions(), enabled: signedOut });

  const guestPanda = useMemo(() => {
    if (!signedOut || !publicIndex.data) return undefined;
    const item = publicIndex.data.find((entry) => entry.slug === slug);
    return item ? { pandaId: item.id, name: item.name } : undefined;
  }, [publicIndex.data, signedOut, slug]);

  const panda = signedOut ? guestPanda : target.data;
  const list = signedOut ? guestList : remoteList;
  const collections = list.data;
  const failed =
    session.status === "unavailable" ||
    (signedIn ? failedWithoutData(target) : failedWithoutData(publicIndex)) ||
    failedWithoutData(list);

  async function replace(next: Collection) {
    if (accountId) await patchCollections(accountId, (current) => current.map((item) => (item.collectionId === next.collectionId ? next : item)));
  }

  async function toggle(collection: Collection, inside: boolean) {
    if (!panda) return;
    setActionFailed(false);
    try {
      if (signedOut) {
        await setInGuestCollection(collection.collectionId, panda.pandaId, inside);
      } else {
        await replace(await setInCollection(collection.collectionId, panda.pandaId, inside));
      }
    } catch {
      setActionFailed(true);
    }
  }

  async function createWithPanda() {
    const valid = collectionName(name);
    if (!valid || !panda) return;
    setActionFailed(false);
    try {
      if (signedOut) {
        const created = await createGuestCollection(valid);
        await setInGuestCollection(created.collectionId, panda.pandaId, true);
      } else {
        const created = await setInCollection((await createCollection(valid)).collectionId, panda.pandaId, true);
        if (accountId) await patchCollections(accountId, (current) => [created, ...current]);
      }
      setName("");
    } catch {
      setActionFailed(true);
    }
  }

  return (
    <Page
      label={panda ? `加入合集　${panda.name}` : "加入合集"}
      title="把它放进合集"
      keyboardShouldPersistTaps="handled"
    >
      {failed ? (
        <LoadFailed
          message="合集暂时打不开。"
          onRetry={() => {
            if (signedIn && failedWithoutData(target)) void target.refetch();
            if (signedOut && failedWithoutData(publicIndex)) void publicIndex.refetch();
            if (failedWithoutData(list)) void list.refetch();
          }}
        />
      ) : !collections || !panda ? (
        <Skeleton className="h-40 w-full" accessibilityLabel="正在加载合集" />
      ) : (
        <>
          {collections.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {collections.map((collection) => {
                const inside = collection.pandaIds.includes(panda.pandaId);
                return (
                  <Toggle
                    key={collection.collectionId}
                    variant="outline"
                    pressed={inside}
                    onPressedChange={(next) => void toggle(collection, next)}
                    accessibilityLabel={collection.name}
                  >
                    <Text>{collection.name}</Text>
                  </Toggle>
                );
              })}
            </View>
          ) : null}
          <View className="gap-2">
            <TextInput
              value={name}
              onChangeText={(value) => setName(value.slice(0, NAME_MAX))}
              placeholder="新合集的名字"
              placeholderTextColor={muted}
              accessibilityLabel="新合集的名字"
              className="h-12 rounded-full border-hairline border-input px-5 text-body text-foreground"
            />
            <Button className="self-start" onPress={() => void createWithPanda()} disabled={!collectionName(name)}>
              <Text>新建并加入</Text>
            </Button>
          </View>
          {actionFailed ? <Text className="text-destructive">没能完成，请再试一次。</Text> : null}
        </>
      )}
    </Page>
  );
}
