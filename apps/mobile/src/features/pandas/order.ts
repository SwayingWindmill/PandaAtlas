type Ranked = { slug: string; deceased: boolean };

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/**
 * The 全部熊猫 order: living pandas first, since they are the ones people can still go and see, then
 * by slug. The slug is the romanized name (a-bao, bo-si, cc), so 阿宝 and an English-only Bo Si
 * fall in one alphabetical run instead of every Latin name sorting ahead of the Chinese ones.
 */
export function comparePandas(a: Ranked, b: Ranked) {
  return Number(a.deceased) - Number(b.deceased) || collator.compare(a.slug, b.slug);
}
