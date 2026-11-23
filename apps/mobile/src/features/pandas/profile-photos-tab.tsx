import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Chip } from "@/components/chip";
import { ListCell, ListSection } from "@/components/grouped-list";
import { RemoteImage } from "@/components/remote-image";
import { Text } from "@/components/ui/text";
import type { Photo, Profile } from "@/features/pandas/profile";
import { openPandaCorrection } from "@/features/pandas/profile-overview";
import { RADIUS } from "@/lib/surface";

const GRID_GAP = 3;
const ALL = "全部";

function creditsOf(photos: Photo[]) {
  const names = [...new Set(photos.map((photo) => photo.creator).filter((name): name is string => Boolean(name)))];
  return names.length > 0 ? `© ${names.join("、")}` : null;
}

function PhotoCell({
  photo,
  size,
  gridIndex,
  targetIndex,
  slug,
}: {
  photo: Photo;
  size: number;
  gridIndex: number;
  targetIndex: number;
  slug: string;
}) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/pandas/[slug]/photos",
          params: { slug, index: String(targetIndex) },
        })
      }
      role="link"
      accessibilityLabel={`照片 ${gridIndex + 1}`}
    >
      <RemoteImage source={photo.url} style={{ width: size, height: size }} contentFit="cover" accessible={false} />
    </Pressable>
  );
}

export function PhotosTab({ profile }: { profile: Profile }) {
  const [width, setWidth] = useState(0);
  const [source, setSource] = useState(ALL);
  const archives = [...new Set(profile.photos.map((photo) => photo.source).filter((name): name is string => Boolean(name)))];
  if (profile.photos.length === 0) {
    return (
      <ListSection>
        <ListCell label="有它的照片？告诉我们" tone="tint" onPress={() => openPandaCorrection(profile.slug)} last />
      </ListSection>
    );
  }
  const photos = source === ALL ? profile.photos : profile.photos.filter((photo) => photo.source === source);
  const fullIndexById = new Map(profile.photos.map((photo, idx) => [photo.id, idx]));
  const cell = Math.floor((width - GRID_GAP * 2) / 3);
  const lead = cell * 2 + GRID_GAP;
  const [first, second, third, ...rest] = photos;
  const credits = creditsOf(photos);
  return (
    <View className="gap-2.5">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text variant="subheadline" className="font-semibold tabular-nums text-muted-foreground">
          {`${photos.length} 张`}
        </Text>
        {archives.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {[ALL, ...archives].map((name) => (
              <Chip key={name} label={name} appearance="ink" selected={source === name} onPress={() => setSource(name)} />
            ))}
          </View>
        ) : null}
      </View>
      <View
        className="overflow-hidden"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ gap: GRID_GAP, borderRadius: RADIUS.tile, borderCurve: "continuous" }}
      >
        {first && cell > 0 ? (
          <View className="flex-row" style={{ gap: GRID_GAP }}>
            <PhotoCell
              photo={first}
              size={lead}
              gridIndex={0}
              targetIndex={fullIndexById.get(first.id) ?? 0}
              slug={profile.slug}
            />
            <View style={{ gap: GRID_GAP }}>
              {second ? (
                <PhotoCell
                  photo={second}
                  size={cell}
                  gridIndex={1}
                  targetIndex={fullIndexById.get(second.id) ?? 1}
                  slug={profile.slug}
                />
              ) : null}
              {third ? (
                <PhotoCell
                  photo={third}
                  size={cell}
                  gridIndex={2}
                  targetIndex={fullIndexById.get(third.id) ?? 2}
                  slug={profile.slug}
                />
              ) : null}
            </View>
          </View>
        ) : null}
        {rest.length > 0 && cell > 0 ? (
          <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
            {rest.map((photo, index) => (
              <PhotoCell
                key={photo.id}
                photo={photo}
                size={cell}
                gridIndex={index + 3}
                targetIndex={fullIndexById.get(photo.id) ?? index + 3}
                slug={profile.slug}
              />
            ))}
          </View>
        ) : null}
      </View>
      {credits ? (
        <Text variant="footnote" className="px-0.5 text-muted-foreground">
          {credits}
        </Text>
      ) : null}
    </View>
  );
}
