import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Linking, Platform, Pressable, FlatList as RNFlatList, StyleSheet, View } from "react-native";
import { FlatList as GestureFlatList, type NativeGesture } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { ChevronLeft, ChevronRight, Download, type LucideIcon, Share, X } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cssEasing } from "@/design/motion";
import { type SaveOutcome, savePhoto, sharePhoto } from "@/features/pandas/photo-actions";
import { type Size, clamp, pageAt } from "@/features/pandas/photo-viewer";
import { type Photo, photosQueryOptions } from "@/features/pandas/profile";
import { ZoomablePhoto } from "@/features/pandas/zoomable-photo";

type Status = { text: string; settings?: true };

const SAVED: Record<SaveOutcome, Status> = {
  saved: { text: "已保存到相册" },
  downloaded: { text: "已开始下载" },
  opened: { text: "已在新标签页打开原图" },
  denied: { text: "没有相册权限，照片没有保存。" },
  blocked: { text: "吱熊猫没有相册权限，请在系统设置里允许添加照片。", settings: true },
};

// On native the pager is gesture-handler's list, so each page's pinch and pan can hold its scroll gesture
// back. Web has no such gesture to hold, and gesture-handler's web list re-renders without end here.
const Pager = (Platform.OS === "web" ? RNFlatList : GestureFlatList) as typeof GestureFlatList;

const counterLabel = (index: number, count: number) => `第 ${index + 1} 张，共 ${count} 张`;

function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // react-native-web cannot detect one and always answers true. Hidden controls stay in the web
    // accessibility tree and show again on focus, so the web needs no gate.
    if (Platform.OS === "web") return;
    void AccessibilityInfo.isScreenReaderEnabled().then(setOn);
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setOn);
    return () => subscription.remove();
  }, []);
  return on;
}

export default function PhotosScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const list = useRef<RNFlatList<Photo>>(null);
  const [pager, setPager] = useState<NativeGesture | null>(null);
  const { data, isError: failed, refetch } = useQuery(photosQueryOptions(slug));
  const [scrolledTo, setScrolledTo] = useState(0);
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  // The pager's own size: every page is one pager wide, so paging survives rotation and resizing.
  const [page, setPage] = useState<Size>({ width: 0, height: 0 });
  const dismissY = useSharedValue(0);
  const screenReader = useScreenReader();
  const hidden = immersive && !screenReader;

  const photos = data?.photos;
  const index = photos ? clamp(scrolledTo, 0, Math.max(photos.length - 1, 0)) : 0;
  const current = photos?.[index];
  // Keyed by photo, so a list that changes under a zoomed photo cannot leave the pager locked.
  const zoomed = current !== undefined && zoomedId === current.id;
  const count = photos?.length ?? 0;

  // A new width leaves the old offset between pages; put the current page back under the viewport.
  const realign = useEffectEvent((width: number) => {
    list.current?.scrollToOffset({ offset: index * width, animated: false });
  });
  useLayoutEffect(() => {
    if (page.width > 0) realign(page.width);
  }, [page.width]);

  useEffect(() => {
    if (!status || status.settings) return;
    const timer = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.get(), [0, Math.max(page.height, 1) * 0.6], [1, 0], "clamp"),
  }));

  const announced = useRef(index);
  useEffect(() => {
    if (Platform.OS !== "ios" || announced.current === index) return;
    announced.current = index;
    AccessibilityInfo.announceForAccessibility(counterLabel(index, count));
  }, [index, count]);

  function go(to: number) {
    list.current?.scrollToIndex({ index: to, animated: true });
    setScrolledTo(to);
  }

  async function run(action: () => Promise<Status | null>, failure: string) {
    setBusy(true);
    try {
      setStatus(await action());
    } catch (error) {
      if (__DEV__) console.warn(failure, error);
      setStatus({ text: failure });
    } finally {
      setBusy(false);
    }
  }

  const reveal = () => setImmersive(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/pandas/${slug}`));
  const chrome = {
    opacity: hidden ? 0 : 1,
    transitionProperty: "opacity",
    transitionDuration: 200,
    transitionTimingFunction: cssEasing("out"),
  } as const;

  return (
    <View role="dialog" aria-modal accessibilityLabel="照片" className="flex-1">
      <StatusBar style="light" hidden={hidden} />
      <Animated.View className="absolute inset-0 bg-black" style={backdrop} />
      {!photos ? (
        <View className="flex-1 justify-center" style={{ paddingTop: insets.top }}>
          {failed ? (
            <LoadFailed message="照片暂时打不开。" onRetry={() => void refetch()} className="mx-5" />
          ) : (
            <Skeleton className="mx-5 h-96" accessibilityLabel="正在加载照片" />
          )}
        </View>
      ) : (
        <Pager
          ref={list}
          onGestureUpdate_CAN_CAUSE_INFINITE_RERENDER={setPager}
          data={photos}
          extraData={{ index, zoomed, page, pager }}
          keyExtractor={(photo) => photo.id}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, item) => ({ length: page.width, offset: page.width * item, index: item })}
          onScroll={(event) => setScrolledTo(pageAt(event.nativeEvent.contentOffset.x, page.width, photos.length))}
          scrollEventThrottle={16}
          style={StyleSheet.absoluteFill}
          onLayout={(event) => setPage({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
          renderItem={({ item, index: position }) => (
            <ZoomablePhoto
              uri={item.url}
              label={`${data.name} 第 ${position + 1} 张照片`}
              size={page}
              active={position === index}
              zoomed={zoomed}
              pager={pager}
              dismissY={dismissY}
              onZoomedChange={(now) => setZoomedId((id) => (now ? item.id : id === item.id ? null : id))}
              onTap={() => setImmersive((now) => !now)}
              onDismiss={close}
            />
          )}
        />
      )}

      <Animated.View
        pointerEvents={hidden ? "none" : "box-none"}
        className="absolute inset-x-0 top-0 flex-row items-center justify-between px-3"
        style={[{ paddingTop: insets.top }, chrome]}
      >
        <Pressable role="button" accessibilityLabel="关闭" onPress={close} onFocus={reveal} className="size-11 items-center justify-center">
          <Icon icon={X} tone="onMedia" size={22} strokeWidth={2} />
        </Pressable>
        {count > 0 ? (
          <Text
            variant="subheadline"
            className="font-semibold text-white tabular-nums"
            accessibilityLabel={counterLabel(index, count)}
            accessibilityLiveRegion="polite"
          >
            {index + 1} / {count}
          </Text>
        ) : null}
        <View className="size-11" />
      </Animated.View>

      {photos && current ? (
        <Animated.View
          pointerEvents={hidden ? "none" : "box-none"}
          className="absolute inset-x-0 bottom-0 gap-3.5 px-5"
          style={[{ paddingBottom: insets.bottom + 16 }, chrome]}
        >
          {status ? (
            <View className="absolute inset-x-5 bottom-full mb-3 items-center gap-1">
              <Text variant="footnote" className="text-center text-white" accessibilityLiveRegion="polite">
                {status.text}
              </Text>
              {status.settings ? (
                <Pressable role="button" onPress={() => void Linking.openSettings()} onFocus={reveal} hitSlop={12} className="active:opacity-60">
                  <Text variant="footnote" className="font-semibold text-white underline">
                    去设置
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View className="gap-0.5">
            <Text variant="headline" className="text-white">
              {data.name}
            </Text>
            {current.credit ? (
              <Text variant="footnote" className="text-white/75">
                {current.credit}
              </Text>
            ) : null}
          </View>
          <View className="flex-row items-center justify-between">
            <Chevron icon={ChevronLeft} label="上一张" disabled={index === 0} onPress={() => go(index - 1)} onFocus={reveal} />
            <View className="flex-row gap-10">
              <Action
                icon={Share}
                label="分享"
                disabled={busy}
                onFocus={reveal}
                onPress={() =>
                  void run(async () => {
                    await sharePhoto(current, data.name);
                    return null;
                  }, "照片暂时分享不了，请稍后再试。")
                }
              />
              <Action
                icon={Download}
                label="保存"
                disabled={busy}
                onFocus={reveal}
                onPress={() => void run(async () => SAVED[await savePhoto(current, data.name)], "照片没有保存下来，请稍后再试。")}
              />
            </View>
            <Chevron
              icon={ChevronRight}
              label="下一张"
              disabled={index === photos.length - 1}
              onPress={() => go(index + 1)}
              onFocus={reveal}
            />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

type ControlProps = { icon: LucideIcon; label: string; disabled: boolean; onPress: () => void; onFocus: () => void };

function Chevron({ icon, label, disabled, onPress, onFocus }: ControlProps) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      disabled={disabled}
      aria-disabled={disabled}
      onPress={onPress}
      onFocus={onFocus}
      className="size-11 items-center justify-center active:opacity-60"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Icon icon={icon} tone="onMedia" size={24} strokeWidth={2} />
    </Pressable>
  );
}

function Action({ icon, label, disabled, onPress, onFocus }: ControlProps) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      disabled={disabled}
      aria-disabled={disabled}
      onPress={onPress}
      onFocus={onFocus}
      className="min-w-14 items-center gap-1 active:opacity-60"
    >
      <Icon icon={icon} tone="onMedia" size={24} />
      <Text variant="footnote" className="font-semibold text-white">
        {label}
      </Text>
    </Pressable>
  );
}
