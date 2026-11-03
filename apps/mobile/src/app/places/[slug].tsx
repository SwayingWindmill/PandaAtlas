import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection, useSingleColumn } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaTile } from "@/components/panda-tile";
import { PhotoOutline } from "@/components/photo-outline";
import { ScreenState } from "@/components/screen-state";
import { Scrim } from "@/components/scrim";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { semantic } from "@/design/tokens";
import { type HeroPhoto, useInstitutionHero } from "@/features/institutions/institution-hero";
import { loadPlacePage } from "@/features/map/load";
import { type MapPandaInput, type PlacePage } from "@/features/map/model";
import { openPanda } from "@/features/pandas/panda-row";
import { RADIUS } from "@/lib/surface";

const GAP = semantic.spacing.row.value;

/** The lead photograph, from curated covers only; a placeholder of the same shape while it is looked up. */
function Lead({ hero }: { hero: HeroPhoto | null | undefined }) {
  if (hero === null) return null;
  if (hero === undefined) return <Skeleton className="w-full rounded-card" style={{ aspectRatio: 4 / 3 }} />;
  return (
    <View
      className="w-full overflow-hidden rounded-card bg-secondary"
      style={{ aspectRatio: 4 / 3, borderCurve: "continuous" }}
      accessible
      role="img"
      accessibilityLabel={`照片里是${hero.pandaName}`}
    >
      <Image source={hero.url} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} accessible={false} />
      <Scrim id="place-lead" height="40%" />
      <Text variant="footnote" className="absolute bottom-row left-inset font-semibold text-on-media" numberOfLines={1}>
        {hero.pandaName}
      </Text>
      <PhotoOutline radius={RADIUS.card} />
    </View>
  );
}

/** Who lives here, as portrait tiles two to a row; one to a row at the largest text sizes. */
function Residents({ pandas }: { pandas: MapPandaInput[] }) {
  const [width, setWidth] = useState(0);
  const columns = useSingleColumn() ? 1 : 2;
  const tile = width > 0 ? Math.floor((width - GAP * (columns - 1)) / columns) : 0;
  return (
    <View className="gap-1.5">
      <Text variant="footnote" role="heading" className="px-inset text-muted-foreground tabular-nums">
        {`住在这里的熊猫　${pandas.length} 只`}
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: GAP }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {tile > 0
          ? pandas.map((panda) => (
              <PandaTile
                key={panda.id}
                pandaId={panda.id}
                name={panda.name}
                width={tile}
                onPress={() => openPanda(panda.slug)}
                accessibilityLabel={panda.name}
              />
            ))
          : null}
      </View>
    </View>
  );
}

function Loaded({ place }: { place: PlacePage }) {
  const hero = useInstitutionHero(place.residents);
  const institution = place.institution;
  return (
    <Animated.View entering={PAGE_ENTER} className="gap-section">
      <Lead hero={place.residents.length > 0 ? hero : null} />
      {place.residents.length > 0 ? (
        <Residents pandas={place.residents} />
      ) : (
        <ScreenState message="现在没有熊猫住在这里。" className="py-stack" />
      )}
      {institution ? (
        <ListSection title="所属">
          <ListCell
            label={institution.name}
            detail="基地和动物园"
            href={{ pathname: "/institutions/[slug]", params: { slug: institution.slug } }}
            accessibilityLabel={`${institution.name}，基地和动物园`}
            last
          />
        </ListSection>
      ) : null}
      {hero?.credit ? (
        <Text variant="footnote" className="px-inset text-muted-foreground">
          {`顶部照片：${hero.pandaName}，${hero.credit}`}
        </Text>
      ) : null}
    </Animated.View>
  );
}

export default function PlaceScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [place, setPlace] = useState<PlacePage | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadPlacePage(slug)
      .then((page) => {
        if (page) setPlace(page);
        else setMissing(true);
      })
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    setMissing(false);
    load();
  }

  if (!place) {
    return (
      <Page title="地点">
        {failed ? (
          <LoadFailed message="这一页暂时打不开。" onRetry={retry} />
        ) : missing ? (
          <ScreenState message="没有这个地点。" />
        ) : (
          <View className="gap-section" accessibilityLabel="正在加载">
            <Skeleton className="w-full rounded-card" style={{ aspectRatio: 4 / 3 }} />
            <View className="flex-row gap-row">
              <Skeleton className="flex-1 rounded-tile" style={{ aspectRatio: 4 / 5 }} />
              <Skeleton className="flex-1 rounded-tile" style={{ aspectRatio: 4 / 5 }} />
            </View>
          </View>
        )}
      </Page>
    );
  }

  return (
    <Page label={place.where ?? undefined} title={place.name}>
      <Loaded place={place} />
    </Page>
  );
}
