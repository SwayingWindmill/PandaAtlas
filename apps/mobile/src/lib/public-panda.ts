import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

/** One public detail is shared by the profile, photos and family views. */
export function loadPandaDetail(slug: string) {
  return queryClient.fetchQuery({
    queryKey: ["public", "panda", slug],
    staleTime: 300_000,
    networkMode: "always",
    queryFn: async () => {
      const { data } = await api.GET("/api/v2/pandas/{slug}", { params: { path: { slug } } });
      if (!data) throw new Error(`Panda ${slug} unavailable`);
      return data;
    },
  });
}
