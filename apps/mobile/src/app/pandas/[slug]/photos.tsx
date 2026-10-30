import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadFailed } from "@/components/load-failed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type Photo, loadPhotos } from "@/features/pandas/profile";

// Swiping pages through the photos (FlatList paging works on iOS, Android and web); the buttons do the same
// for keyboards and screen readers.
export default function PhotosScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<Photo>>(null);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);

  const load = useCallback(() => {
    loadPhotos(slug)
      .then(setPhotos)
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  function go(to: number) {
    list.current?.scrollToIndex({ index: to, animated: true });
    setIndex(to);
  }

  const current = photos?.[index];
  return (
    <View
      role="dialog"
      aria-modal
      accessibilityLabel="照片"
      className="flex-1 bg-background"
      style={{ paddingBottom: insets.bottom + 12 }}
    >
      <Stack.Screen options={{ title: photos && photos.length > 0 ? `${index + 1} / ${photos.length}` : "照片" }} />
      {photos && photos.length > 0 ? (
        <Text variant="footnote" className="py-2 text-center text-muted-foreground" accessibilityLiveRegion="polite">
          {index + 1} / {photos.length}
        </Text>
      ) : null}
      {photos === null ? (
        failed ? (
          <LoadFailed message="照片暂时打不开。" onRetry={() => { setFailed(false); load(); }} className="mx-5 mt-6" />
        ) : (
          <Skeleton className="mx-5 mt-6 h-96" accessibilityLabel="正在加载照片" />
        )
      ) : (
        <>
          <FlatList
            ref={list}
            data={photos}
            keyExtractor={(photo) => photo.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, item) => ({ length: width, offset: width * item, index: item })}
            onScroll={(event) => {
              const page = Math.round(event.nativeEvent.contentOffset.x / width);
              setIndex(Math.min(Math.max(page, 0), photos.length - 1));
            }}
            scrollEventThrottle={16}
            className="mt-4 flex-1"
            renderItem={({ item, index: position }) => (
              <Image
                source={item.url}
                style={{ width, height: "100%" }}
                contentFit="contain"
                accessibilityLabel={`第 ${position + 1} 张照片`}
              />
            )}
          />
          <View className="gap-3 px-5 pt-4">
            {current?.credit ? (
              <Text variant="footnote" className="text-muted-foreground">
                {current.credit}
              </Text>
            ) : null}
            {photos.length > 1 ? (
              <View className="flex-row justify-between">
                <Button variant="secondary" disabled={index === 0} onPress={() => go(index - 1)}>
                  <Text>上一张</Text>
                </Button>
                <Button
                  variant="secondary"
                  disabled={index === photos.length - 1}
                  onPress={() => go(index + 1)}
                >
                  <Text>下一张</Text>
                </Button>
              </View>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}
