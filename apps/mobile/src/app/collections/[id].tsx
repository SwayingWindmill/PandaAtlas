import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Chevron, ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import {
  type Collection,
  NAME_MAX,
  collectionName,
  deleteCollection,
  loadCollections,
  renameCollection,
  setInCollection,
} from "@/features/collections/collections";
import { Mosaic } from "@/features/collections/mosaic";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, listMeta, loadPandaIndex } from "@/features/pandas/pandas";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

const PHOTO = 56;
const HERO = 88;

/** The update stamp is an instant; read it on the device's own calendar, not UTC's. */
function updatedOn(stamp: string): string {
  const at = new Date(stamp);
  return Number.isNaN(at.getTime()) ? "最近" : `${at.getMonth() + 1}月${at.getDate()}日`;
}

/** Reminders' rename: the name field and 完成 share one grouped row, with the limit under it. */
function Rename({ collection, onDone }: { collection: Collection; onDone: (next: Collection | null) => void }) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  const [name, setName] = useState(collection.name);
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");
  const valid = collectionName(name);
  const ready = Boolean(valid) && status !== "saving";

  async function save() {
    if (!valid) return;
    if (valid === collection.name) return onDone(null);
    setStatus("saving");
    try {
      onDone(await renameCollection(collection.collectionId, valid));
    } catch {
      setStatus("failed");
    }
  }

  return (
    <View className="gap-1.5">
      <View
        className="min-h-11 flex-row items-center gap-row overflow-hidden rounded-group bg-card pl-inset"
        style={{ borderCurve: "continuous" }}
      >
        <TextInput
          value={name}
          onChangeText={(value) => setName(value.slice(0, NAME_MAX))}
          onSubmitEditing={() => void save()}
          placeholder="合集的名字"
          placeholderTextColor={muted}
          accessibilityLabel="合集的名字"
          returnKeyType="done"
          autoFocus
          selectTextOnFocus
          className="min-h-11 min-w-0 flex-1 py-row text-body text-foreground"
        />
        <Pressable
          onPress={() => void save()}
          disabled={!ready}
          role="button"
          accessibilityState={{ disabled: !ready }}
          className="min-h-11 justify-center px-inset active:opacity-60"
        >
          <Text variant="headline" className={ready ? "text-primary" : "text-muted-foreground"}>
            完成
          </Text>
        </Pressable>
      </View>
      <View className="flex-row items-center justify-between gap-row px-inset">
        <Text
          variant="footnote"
          className={cn("min-w-0 flex-1", status === "failed" ? "text-destructive" : "text-muted-foreground")}
          accessibilityLiveRegion="polite"
        >
          {status === "failed" ? "没能改名，请再试一次。" : `最多 ${NAME_MAX} 个字`}
        </Text>
        <Pressable onPress={() => onDone(null)} role="button" className="min-h-11 justify-center active:opacity-60">
          <Text variant="footnote" className="text-primary">
            取消
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * One panda in the album, as Music lists a playlist: tap to open it. While editing, the row
 * trades its chevron for 移出, as a playlist's edit mode does, so nothing is removed by a stray tap.
 */
function MemberRow({
  panda,
  editing,
  last,
  onRemove,
}: {
  panda: PandaListItem;
  editing: boolean;
  last: boolean;
  onRemove: () => void;
}) {
  const stacked = useStacked();
  const meta = listMeta(panda);
  return (
    <View>
      <View className={cn("min-h-11 flex-row pr-inset", stacked ? "items-start" : "items-center")}>
        <Pressable
          onPress={() => openPanda(panda.slug)}
          role="button"
          accessibilityLabel={meta ? `${panda.name}，${meta}` : panda.name}
          className={cn("min-w-0 flex-1 gap-row py-stack-tight pl-inset active:opacity-70", stacked ? "items-start" : "flex-row items-center")}
        >
          <PandaThumb pandaId={panda.id} name={panda.name} size={PHOTO} />
          <View className={cn("min-w-0 gap-hair-gap", stacked ? "self-stretch" : "flex-1")}>
            <Text variant="headline" numberOfLines={stacked ? undefined : 1}>
              {panda.name}
            </Text>
            {meta ? (
              <Text variant="footnote" className="text-muted-foreground" numberOfLines={stacked ? undefined : 1}>
                {meta}
              </Text>
            ) : null}
          </View>
          {editing || stacked ? null : <Chevron />}
        </Pressable>
        {editing ? (
          <Pressable
            onPress={onRemove}
            role="button"
            accessibilityLabel={`把${panda.name}移出合集`}
            className="min-h-11 min-w-11 items-center justify-center pl-row active:opacity-60"
          >
            <Text variant="body" className="text-destructive">
              移出
            </Text>
          </Pressable>
        ) : null}
      </View>
      {last ? null : <View className="bg-border" style={{ height: HAIRLINE, marginLeft: stacked ? 16 : 16 + PHOTO + 12 }} />}
    </View>
  );
}

function Loading() {
  return (
    <View className="gap-section" accessibilityLabel="正在加载合集">
      <View className="flex-row items-center gap-stack">
        <Skeleton className="rounded-tile" style={{ width: HERO, height: HERO }} />
        <View className="flex-1 gap-stack-tight">
          <Skeleton className="h-6 w-28 rounded-control" />
          <Skeleton className="h-4 w-40 rounded-control" />
        </View>
      </View>
      <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
        {[0, 1, 2, 3].map((row) => (
          <View key={row} className="flex-row items-center gap-row px-inset py-stack-tight">
            <Skeleton className="rounded-tile" style={{ width: PHOTO, height: PHOTO }} />
            <View className="flex-1 gap-stack-tight">
              <Skeleton className="h-4 w-24 rounded-control" />
              <Skeleton className="h-3 w-40 rounded-control" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

type Load = { status: "loading" } | { status: "failed" } | { status: "missing" } | { status: "ready"; collection: Collection };

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<Load>({ status: "loading" });
  const [pandas, setPandas] = useState<Map<string, PandaListItem>>(new Map());
  const [mode, setMode] = useState<"view" | "edit" | "rename" | "confirmDelete">("view");
  const [removed, setRemoved] = useState<PandaListItem | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const stacked = useStacked();

  const load = useCallback(() => {
    Promise.all([loadCollections(), loadPandaIndex()])
      .then(([collections, index]) => {
        setPandas(new Map(index.map((panda) => [panda.id, panda])));
        const found = collections.find((item) => item.collectionId === id);
        setState(found ? { status: "ready", collection: found } : { status: "missing" });
      })
      .catch(() => setState({ status: "failed" }));
  }, [id]);
  useEffect(load, [load]);

  if (state.status !== "ready") {
    return (
      <Page title="合集">
        {state.status === "failed" ? (
          <LoadFailed
            message="这个合集暂时打不开。"
            onRetry={() => {
              setState({ status: "loading" });
              load();
            }}
          />
        ) : state.status === "missing" ? (
          <ScreenState message="这个合集已经不在了。" actionLabel="回到我的合集" onAction={() => router.back()} />
        ) : (
          <Loading />
        )}
      </Page>
    );
  }

  const { collection } = state;
  const set = (next: Collection) => setState({ status: "ready", collection: next });

  async function run(work: () => Promise<void>) {
    setActionFailed(false);
    try {
      await work();
    } catch {
      setActionFailed(true);
    }
  }

  const remove = (panda: PandaListItem) =>
    run(async () => {
      set(await setInCollection(collection.collectionId, panda.id, false));
      setRemoved(panda);
    });
  const undo = (panda: PandaListItem) =>
    run(async () => {
      set(await setInCollection(collection.collectionId, panda.id, true));
      setRemoved(null);
    });
  const destroy = () =>
    run(async () => {
      setDeleting(true);
      try {
        await deleteCollection(collection.collectionId);
        router.back();
      } finally {
        setDeleting(false);
      }
    });

  const members = collection.pandaIds.flatMap((pandaId) => pandas.get(pandaId) ?? []);
  const editing = mode === "edit";
  return (
    <Page title={collection.name} keyboardShouldPersistTaps="handled">
      <Animated.View entering={PAGE_ENTER} className="gap-section">
        {/* Photos' album header: the cover the grid showed, so the album you tapped is the one that opened. */}
        <View className={cn("gap-stack", !stacked && "flex-row items-center")}>
          <Mosaic pandaIds={collection.pandaIds} size={HERO} />
          <View className="min-w-0 flex-1 gap-hair-gap">
            <Text variant="stat">
              {members.length > 0 ? `${members.length} 只熊猫` : "还没有熊猫"}
            </Text>
            <Text variant="footnote" className="text-muted-foreground">
              {`${updatedOn(collection.updatedAt)}更新 · 只有你看得到`}
            </Text>
          </View>
        </View>
        {mode === "rename" ? (
          <Rename
            collection={collection}
            onDone={(next) => {
              if (next) set(next);
              setMode("view");
            }}
          />
        ) : null}
        {members.length === 0 ? (
          <ScreenState
            message="在熊猫的资料页点「加入合集」，它就会放进来。"
            actionLabel="去找熊猫"
            onAction={() => router.push("/find")}
            className="rounded-group bg-card"
          />
        ) : (
          <View className="gap-row">
            <View className="flex-row items-center justify-between px-inset">
              <Text variant="footnote" role="heading" className="text-muted-foreground">
                熊猫
              </Text>
              <Pressable
                onPress={() => {
                  setRemoved(null);
                  setMode(editing ? "view" : "edit");
                }}
                role="button"
                accessibilityLabel={editing ? "完成编辑" : "编辑合集里的熊猫"}
                className="min-h-11 justify-center active:opacity-60"
              >
                <Text variant="body" className={cn("text-primary", editing && "font-semibold")}>
                  {editing ? "完成" : "编辑"}
                </Text>
              </Pressable>
            </View>
            <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
              {members.map((panda, index) => (
                <MemberRow
                  key={panda.id}
                  panda={panda}
                  editing={editing}
                  last={index === members.length - 1}
                  onRemove={() => void remove(panda)}
                />
              ))}
            </View>
          </View>
        )}
        {removed ? (
          <View
            className="min-h-11 flex-row items-center gap-row rounded-group bg-card pl-inset"
            style={{ borderCurve: "continuous" }}
            accessibilityLiveRegion="polite"
          >
            <Text variant="subheadline" className="min-w-0 flex-1">{`已把${removed.name}移出`}</Text>
            <Pressable
              onPress={() => void undo(removed)}
              role="button"
              accessibilityLabel={`撤销，把${removed.name}放回合集`}
              className="min-h-11 justify-center px-inset active:opacity-60"
            >
              <Text variant="headline" className="text-primary">
                撤销
              </Text>
            </Pressable>
          </View>
        ) : null}
        {actionFailed ? (
          <Text variant="footnote" className="px-inset text-destructive" accessibilityLiveRegion="polite">
            没能完成，请再试一次。
          </Text>
        ) : null}
        {mode === "confirmDelete" ? (
          <Animated.View
            entering={PAGE_ENTER}
            className="gap-row rounded-card bg-card p-stack"
            style={{ borderCurve: "continuous" }}
          >
            <View className="gap-hair-gap">
              <Text variant="headline" role="heading">{`删除「${collection.name}」？`}</Text>
              <Text variant="subheadline" className="text-muted-foreground">
                只删除这个合集，里面的熊猫和你的关注、图鉴都不受影响。
              </Text>
            </View>
            <Button variant="destructive" onPress={() => void destroy()} disabled={deleting}>
              <Text>删除合集</Text>
            </Button>
            <Button variant="plain" onPress={() => setMode("view")}>
              <Text>取消</Text>
            </Button>
          </Animated.View>
        ) : (
          <ListSection>
            <ListCell tone="tint" label="改名字" onPress={() => setMode("rename")} />
            <ListCell tone="destructive" label="删除合集" onPress={() => setMode("confirmDelete")} last />
          </ListSection>
        )}
      </Animated.View>
    </Page>
  );
}
