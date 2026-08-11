import type { PublicLocale } from "@/foundation/content/locales";
import type { PandaDetail, PublicPandaMediaAsset } from "@/lib/types";

export interface GamePanda {
  id: string;
  slug: string;
  name: string;
  alternateName: string | null;
  imageUrl: string | null;
  imageAlt: string;
  birthYear: string | null;
  currentLocation: string | null;
}

function imageAsset(panda: PandaDetail): PublicPandaMediaAsset | null {
  const available = panda.media.filter((asset) => asset.status === "available");
  return available.find((asset) =>
    asset.url === panda.cover_image_url
    || asset.derivatives.some((derivative) => derivative.url === panda.cover_image_url),
  ) ?? available[0] ?? null;
}

export function buildGamePandas(pandas: PandaDetail[], locale: PublicLocale): GamePanda[] {
  return pandas.map((panda) => {
    const asset = imageAsset(panda);
    const derivative = asset?.derivatives
      .filter((item) => item.width >= 800)
      .sort((left, right) => right.width - left.width)[0]
      ?? asset?.derivatives[0]
      ?? null;
    const imageUrl = panda.cover_image_url ?? derivative?.url ?? asset?.url ?? null;
    const name = locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
    const alternateName = locale === "zh" ? panda.name_en : panda.name_zh;
    const reviewedAlt = locale === "zh" ? asset?.alt_zh : asset?.alt_en;

    return {
      id: panda.id,
      slug: panda.slug,
      name,
      alternateName: alternateName ?? null,
      imageUrl,
      imageAlt: reviewedAlt
        ?? (locale === "zh" ? `${name}的公开照片` : `Published photograph of ${name}`),
      birthYear: panda.birth_date?.slice(0, 4) ?? null,
      currentLocation: panda.current_location,
    };
  });
}
