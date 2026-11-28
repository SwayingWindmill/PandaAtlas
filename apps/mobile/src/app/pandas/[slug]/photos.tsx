import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { HeaderBackButton } from "expo-router/react-navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FlatList, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Download, Share } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { ScreenState } from "@/components/screen-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type SaveOutcome, savePhoto, sharePhoto } from "@/features/pandas/photo-actions";
import { parsePhotoIndex } from "@/features/pandas/photo-zoom";
import { type Photo, photosQueryOptions } from "@/features/pandas/profile";
import { ZoomablePhoto } from "@/features/pandas/zoomable-photo";

const SAVED: Record<SaveOutcome, string> = {
  saved: "已保存到相册",
  downloaded: "已开始下载",
  opened: "已在新标签页打开原图",
  denied: "没有相册权限，照片没有保存。",
  blocked: "保存需要相册权限，请在系统设置里允许吱熊猫添加照片。",
};

// Swiping pages through the photos (FlatList paging works on iOS, Android and web); the buttons and zoom
// control do the same for keyboards and screen readers.
export default function PhotosScreen() {
  const { slug, index: indexParam } = useLocalSearchParams<{ slug: string; index?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<Photo>>(null);
  const { data, isError: failed, refetch } = useQuery(photosQueryOptions(slug));
  const photos = data?.photos;
  const pandaName = data?.name ?? "";
  const requestedIndex = parsePhotoIndex(indexParam, Number.MAX_SAFE_INTEGER);
  const initialIndex = parsePhotoIndex(indexParam, photos?.length ?? 0);
  const [selected, setSelected] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  // Defer scroll-sync until photos load and initial non-zero scroll completes.
  const [aligned, setAligned] = useState(requestedIndex === 0);
  // The pager's own height: a percentage height inside a horizontal list resolves to 0 on web.
  const [pageHeight, setPageHeight] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const index = Math.min(selected ?? initialIndex, Math.max((photos?.length ?? 1) - 1, 0));

  useEffect(() => {
    if (!photos || photos.length === 0 || width <= 0 || pageHeight <= 0 || aligned) return;
    list.current?.scrollToIndex({ index: initialIndex, animated: false });
    const timer = setTimeout(() => setAligned(true), 50);
    return () => clearTimeout(timer);
  }, [aligned, initialIndex, pageHeight, photos, width]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  function go(to: number) {
    setZoomed(false);
    setAligned(true);
    setSelected(to);
    list.current?.scrollToIndex({ index: to, animated: true });
  }

  async function runAction(action: () => Promise<string | null>, failure: string) {
    setBusy(true);
    try {
      setStatus(await action());
    } catch (error) {
      if (__DEV__) console.warn(failure, error);
      setStatus(failure);
    } finally {
      setBusy(false);
    }
  }

  const current = photos?.[index];
  const navigation = useNavigation();
  useLayoutEffect(() => {
    const needsBack = !navigation.canGoBack();
    navigation.setOptions({
      title: "照片",
      headerLeft: needsBack
        ? (props: { tintColor?: string }) => (
            <HeaderBackButton
              {...props}
              label="返回"
              accessibilityLabel="返回"
              onPress={() => router.replace({ pathname: "/pandas/[slug]", params: { slug } })}
            />
          )
        : undefined,
    });
  }, [navigation, slug]);

  return (
    <View
      role="dialog"
      aria-modal
      accessibilityLabel="照片"
      className="flex-1 bg-background"
      style={{ paddingBottom: insets.bottom + 12 }}
    >
      {/* The counter lives once, under the bar, where VoiceOver hears it change. */}
      {photos && photos.length > 0 ? (
        <Text variant="footnote" className="py-2 text-center text-muted-foreground" accessibilityLiveRegion="polite">
          {index + 1} / {photos.length}
        </Text>
      ) : null}
      {!photos ? (
        failed ? (
          <LoadFailed message="照片暂时打不开。" onRetry={() => void refetch()} className="mx-5 mt-6" />
        ) : (
          <Skeleton className="mx-5 mt-6 h-96" accessibilityLabel="正在加载照片" />
        )
      ) : photos.length === 0 ? (
        <ScreenState message="暂无照片。" />
      ) : (
        <>
          <FlatList
            ref={list}
            data={photos}
            keyExtractor={(photo) => photo.id}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            initialScrollIndex={initialIndex}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, item) => ({ length: width, offset: width * item, index: item })}
            onScrollBeginDrag={() => setAligned(true)}
            onScroll={(event) => {
              if (!aligned || width <= 0) return;
              const page = Math.min(Math.max(Math.round(event.nativeEvent.contentOffset.x / width), 0), photos.length - 1);
              if (page !== index) {
                setZoomed(false);
                setSelected(page);
              }
            }}
            scrollEventThrottle={16}
            className="mt-4 flex-1"
            onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
            renderItem={({ item, index: position }) => (
              <ZoomablePhoto
                uri={item.url}
                width={width}
                height={pageHeight}
                active={position === index}
                zoomed={position === index ? zoomed : false}
                onZoomChange={setZoomed}
                accessibilityLabel={`第 ${position + 1} 张照片`}
              />
            )}
          />
          <View className="gap-2.5 px-5 pt-3">
            {status ? (
              <View role="status" accessibilityLiveRegion="polite">
                <Text variant="footnote" className="text-center text-primary">
                  {status}
                </Text>
              </View>
            ) : null}
            <Text variant="footnote" className="text-center text-muted-foreground">
              双指缩放　双击放大　左右滑动切换
            </Text>
            {current?.credit ? (
              <Text variant="footnote" className="text-muted-foreground">
                {current.credit}
              </Text>
            ) : null}
            {current ? (
              <View className="flex-row items-center justify-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  aria-disabled={busy}
                  accessibilityLabel="分享"
                  onPress={() =>
                    void runAction(async () => {
                      await sharePhoto(current, pandaName);
                      return null;
                    }, "照片暂时分享不了，请稍后再试。")
                  }
                >
                  <Icon icon={Share} size="footnote" tone="label" />
                  <Text>分享</Text>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  aria-disabled={busy}
                  accessibilityLabel="保存"
                  onPress={() =>
                    void runAction(
                      async () => SAVED[await savePhoto(current, pandaName)],
                      "照片没有保存下来，请稍后再试。",
                    )
                  }
                >
                  <Icon icon={Download} size="footnote" tone="label" />
                  <Text>保存</Text>
                </Button>
              </View>
            ) : null}
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              {photos.length > 1 ? (
                <Button variant="secondary" size="sm" disabled={index === 0} onPress={() => go(index - 1)}>
                  <Text>上一张</Text>
                </Button>
              ) : (
                <View />
              )}
              <Button
                variant="tinted"
                size="sm"
                accessibilityLabel={zoomed ? "还原照片大小" : "放大照片"}
                onPress={() => setZoomed((currentZoom) => !currentZoom)}
              >
                <Text>{zoomed ? "还原" : "放大"}</Text>
              </Button>
              {photos.length > 1 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={index === photos.length - 1}
                  onPress={() => go(index + 1)}
                >
                  <Text>下一张</Text>
                </Button>
              ) : (
                <View />
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}
