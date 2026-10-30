import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, TextInput, useWindowDimensions, View } from "react-native";
import Animated from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { FolderHeart } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { semantic } from "@/design/tokens";
import {
  type Collection,
  NAME_MAX,
  collectionName,
  createCollection,
  loadCollections,
} from "@/features/collections/collections";
import { usePandaCover } from "@/lib/covers";
import { RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

const GAP = semantic.spacing.inset.value;
/** The hairline of background between the four covers of a mosaic. */
const SEAM = 2;

function NewCollection({ onCreated }: { onCreated: (collection: Collection) => void }) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");
  const ready = Boolean(collectionName(name)) && status !== "saving";

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
    <View className="gap-1.5">
      {/* Reminders' new list: the name field and its one action share a grouped row. */}
      <View
        className="min-h-11 flex-row items-center gap-row overflow-hidden rounded-group bg-card pl-inset"
        style={{ borderCurve: "continuous" }}
      >
        <TextInput
          value={name}
          onChangeText={(value) => setName(value.slice(0, NAME_MAX))}
          onSubmitEditing={() => void create()}
          placeholder="新合集的名字"
          placeholderTextColor={muted}
          accessibilityLabel="新合集的名字"
          returnKeyType="done"
          className="min-h-11 min-w-0 flex-1 py-row text-body text-foreground"
        />
        <Pressable
          onPress={() => void create()}
          disabled={!ready}
          role="button"
          accessibilityState={{ disabled: !ready }}
          className="min-h-11 justify-center px-inset active:opacity-60"
        >
          <Text variant="headline" className={ready ? "text-primary" : "text-muted-foreground"}>
            新建
          </Text>
        </Pressable>
      </View>
      <Text variant="footnote" className={cn("px-inset", status === "failed" ? "text-destructive" : "text-muted-foreground")}>
        {status === "failed" ? "没能新建，请再试一次。" : "起个名字，把喜欢的熊猫放在一起。"}
      </Text>
    </View>
  );
}

function Cover({ pandaId, size }: { pandaId: string; size: number }) {
  const photo = usePandaCover(pandaId);
  return (
    <View className="bg-secondary" style={{ width: size, height: size }}>
      {photo ? (
        <Image source={photo} style={{ width: size, height: size }} contentFit="cover" transition={200} accessible={false} />
      ) : null}
    </View>
  );
}

/** Photos' album cover: the first four pandas as a 2×2 mosaic; one panda fills it; none shows the folder. */
function Mosaic({ pandaIds, size }: { pandaIds: string[]; size: number }) {
  const half = (size - SEAM) / 2;
  return (
    <View
      className="overflow-hidden rounded-tile bg-secondary"
      style={{ width: size, height: size, borderCurve: "continuous" }}
    >
      {pandaIds.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Icon icon={FolderHeart} size="title3" tone="secondary" />
        </View>
      ) : pandaIds.length < 4 ? (
        <Cover pandaId={pandaIds[0] ?? ""} size={size} />
      ) : (
        <View className="flex-row flex-wrap bg-card" style={{ gap: SEAM }}>
          {pandaIds.slice(0, 4).map((id) => (
            <Cover key={id} pandaId={id} size={half} />
          ))}
        </View>
      )}
      {pandaIds.length > 0 ? <PhotoOutline radius={RADIUS.tile} /> : null}
    </View>
  );
}

function Album({ collection, width }: { collection: Collection; width: number }) {
  const count = collection.pandaIds.length;
  return (
    <PressScale
      onPress={() => router.push({ pathname: "/collections/[id]", params: { id: collection.collectionId } })}
      role="button"
      accessibilityLabel={`${collection.name}，${count} 只`}
      style={{ width }}
    >
      <View className="gap-stack-tight">
        <Mosaic pandaIds={collection.pandaIds} size={width} />
        <View className="gap-hair-gap px-hair-gap">
          <Text variant="headline" numberOfLines={2}>
            {collection.name}
          </Text>
          <Text variant="footnote" className="text-muted-foreground tabular-nums">
            {count > 0 ? `${count} 只` : "还是空的"}
          </Text>
        </View>
      </View>
    </PressScale>
  );
}

function Albums({ collections }: { collections: Collection[] }) {
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const columns = fontScale >= 2 ? 1 : 2;
  const tile = width > 0 ? Math.floor((width - GAP * (columns - 1)) / columns) : 0;
  return (
    <View
      className="flex-row flex-wrap"
      style={{ columnGap: GAP, rowGap: semantic.spacing.stack.value }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {tile > 0 ? collections.map((collection) => <Album key={collection.collectionId} collection={collection} width={tile} />) : null}
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
    <Page
      label={collections && collections.length > 0 ? `${collections.length} 个合集` : undefined}
      title="我的合集"
      keyboardShouldPersistTaps="handled"
    >
      {failed ? (
        <LoadFailed message="合集暂时打不开。" onRetry={load} />
      ) : collections === null ? (
        <View className="gap-section" accessibilityLabel="正在加载合集">
          <Skeleton className="h-11 w-full rounded-group" />
          <View className="flex-row gap-inset">
            <Skeleton className="aspect-square flex-1 rounded-tile" />
            <Skeleton className="aspect-square flex-1 rounded-tile" />
          </View>
        </View>
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          <NewCollection onCreated={(created) => setCollections((current) => [created, ...(current ?? [])])} />
          {collections.length === 0 ? (
            <ScreenState message="还没有合集。" className="py-stack" />
          ) : (
            <Albums collections={collections} />
          )}
        </Animated.View>
      )}
    </Page>
  );
}
