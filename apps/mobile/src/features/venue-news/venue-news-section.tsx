import { useQuery } from "@tanstack/react-query";
import { Linking } from "react-native";

import { ListCell, ListSection } from "@/components/grouped-list";

import { type VenueNewsItem, loadVenueNews, newsDetail, sourceHost } from "./venue-news";

export function VenueNewsRow({ item, last }: { item: VenueNewsItem; last: boolean }) {
  return (
    <ListCell
      label={item.headline}
      detail={newsDetail(item)}
      role="link"
      lines={3}
      onPress={() => void Linking.openURL(item.sourceUrl)}
      accessibilityHint={`打开 ${sourceHost(item.sourceUrl)} 的原文`}
      last={last}
    />
  );
}

/** 场馆动态 on an institution page: the three newest official notices. Hidden when there are none. */
export function VenueNewsSection({ institutionSlug }: { institutionSlug: string }) {
  const { data } = useQuery({
    queryKey: ["venue-news", institutionSlug],
    queryFn: () => loadVenueNews(institutionSlug),
  });
  if (!data || data.length === 0) return null;
  const shown = data.slice(0, 3);
  return (
    <ListSection title="场馆动态">
      {shown.map((item, index) => (
        <VenueNewsRow key={item.id} item={item} last={index === shown.length - 1 && data.length <= 3} />
      ))}
      {data.length > 3 ? (
        <ListCell
          label="全部动态"
          tone="tint"
          href={{ pathname: "/venue-news", params: { institution: institutionSlug } }}
          last
        />
      ) : null}
    </ListSection>
  );
}
