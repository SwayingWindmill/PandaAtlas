import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";

import { ListCell, ListSection, SectionTitle } from "@/components/grouped-list";
import { Newspaper } from "@/components/icons";

import { NewsTimeline } from "./news-timeline";
import { useNewsContext } from "./use-news-context";
import { loadVenueNews } from "./venue-news";

const SHOWN = 3;

/** 场馆动态 on an institution page: the three newest official notices on the timeline card. Hidden when there are none. */
export function VenueNewsSection({ institutionSlug }: { institutionSlug: string }) {
  const { data } = useQuery({
    queryKey: ["venue-news", institutionSlug],
    queryFn: () => loadVenueNews(institutionSlug),
  });
  const { venues, pandas } = useNewsContext();
  if (!data || data.length === 0) return null;
  return (
    <View className="gap-stack-tight">
      <SectionTitle title="场馆动态" icon={Newspaper} />
      <NewsTimeline items={data.slice(0, SHOWN)} venues={venues} pandas={pandas} showVenue={false} />
      {data.length > SHOWN ? (
        <ListSection>
          <ListCell
            label="全部动态"
            meta={`${data.length} 条`}
            href={{ pathname: "/venue-news", params: { institution: institutionSlug } }}
            last
          />
        </ListSection>
      ) : null}
    </View>
  );
}
