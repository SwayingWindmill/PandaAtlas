"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { ArchiveResultRow, type ArchiveSearchResult } from "@/components/command-menu-04";
import { Command, CommandGroup, CommandList } from "@/components/ui/command";
import type { PublicLocale } from "@/foundation/content/locales";
import { cn } from "@/lib/utils";

import {
  SEARCH_KINDS,
  SEARCH_QUERY_MAX_LENGTH,
  searchHref,
  type SearchKindFilter,
  type SearchQueryState,
} from "./archive-search";

const copy = {
  zh: {
    label: "搜索熊猫、家族和地点",
    placeholder: "输入熊猫名字、家族或地点，中英文都可以",
    filters: "按类型筛选",
    kinds: { all: "全部", panda: "熊猫", family: "家族", place: "地点" },
    results: "搜索结果",
    count: (count: number, q: string) => `“${q}”有 ${count} 个结果`,
    searching: "正在搜索…",
    noResults: (q: string) => `当前公开资料里没有与“${q}”匹配的内容。`,
    noResultsHint: "试试熊猫的中文名、英文名或拼音，或者换一个地点名称。也可以从下面的入口慢慢逛。",
    otherKinds: (count: number) => `在全部类型中查看 ${count} 个结果`,
    startHint: "输入至少一个字开始搜索。结果来自已公开的熊猫档案、家族故事和地点。",
    browse: "从这里开始逛",
    browseLinks: { pandas: "熊猫图鉴", families: "熊猫家族", map: "熊猫地图" },
  },
  en: {
    label: "Search pandas, families, and places",
    placeholder: "Type a panda, family, or place name in English or Chinese",
    filters: "Filter by type",
    kinds: { all: "All", panda: "Pandas", family: "Families", place: "Places" },
    results: "Search results",
    count: (count: number, q: string) => `${count} ${count === 1 ? "result" : "results"} for “${q}”`,
    searching: "Searching…",
    noResults: (q: string) => `Nothing in the published records matches “${q}”.`,
    noResultsHint: "Try a panda's Chinese name, English name, or pinyin, or another place name. Or start browsing below.",
    otherKinds: (count: number) => `See ${count} ${count === 1 ? "result" : "results"} across all types`,
    startHint: "Type at least one character to search published panda profiles, family stories, and places.",
    browse: "Start browsing",
    browseLinks: { pandas: "Panda guide", families: "Panda families", map: "Panda map" },
  },
} as const;

export function SearchWorkspace({
  locale,
  state,
  results,
  counts,
}: {
  locale: PublicLocale;
  state: SearchQueryState;
  results: ArchiveSearchResult[];
  counts: Record<SearchKindFilter, number>;
}) {
  const t = copy[locale];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(state.q);
  const [committed, setCommitted] = useState(state.q);
  const [syncedQ, setSyncedQ] = useState(state.q);
  const selectingByKeyboard = useRef(false);

  // Back/forward navigation changes the URL query; our own commits echo back unchanged.
  if (state.q !== syncedQ) {
    setSyncedQ(state.q);
    setCommitted(state.q);
    if (state.q !== committed) setQuery(state.q);
  }

  const commit = (next: string) => {
    setCommitted(next);
    startTransition(() => {
      router.replace(searchHref(locale, { q: next, type: state.type }) as Route, { scroll: false });
    });
  };

  useEffect(() => {
    const next = query.trim();
    if (next === committed) return;
    const timer = setTimeout(() => commit(next), 300);
    return () => clearTimeout(timer);
  });

  const needle = state.q.toLocaleLowerCase();
  const kinds: SearchKindFilter[] = ["all", ...SEARCH_KINDS];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <form action={`/${locale}/search`} method="get" role="search" aria-label={t.label}>
        {state.type !== "all" ? <input type="hidden" name="type" value={state.type} /> : null}
        <Command
          className="h-auto overflow-visible rounded-[1.5rem] border border-[rgb(24_49_42/18%)] bg-[#fffaf0] text-[#18312a] shadow-[0_18px_50px_rgb(39_61_51/10%)]"
          label={t.label}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            // A query typed faster than the debounce runs first; Enter then picks the highlighted result.
            if (query.trim() !== committed) {
              event.preventDefault();
              commit(query.trim());
              return;
            }
            selectingByKeyboard.current = true;
          }}
          shouldFilter={false}
        >
          <div className={cn("flex min-h-16 items-center gap-3 px-4 sm:px-5", results.length && "border-b border-[rgb(24_49_42/14%)]")}>
            <Search className="size-5 shrink-0 text-[#486158]" aria-hidden="true" />
            <CommandPrimitive.Input
              autoFocus={!state.q}
              className="min-w-0 flex-1 bg-transparent py-4 text-base outline-none placeholder:text-[#6b7f77]"
              enterKeyHint="search"
              maxLength={SEARCH_QUERY_MAX_LENGTH}
              name="q"
              onValueChange={setQuery}
              placeholder={t.placeholder}
              value={query}
            />
          </div>

          {results.length ? (
            <CommandList className="max-h-none px-1 py-2">
              <CommandGroup
                heading={t.results}
                className="p-0 **:[[cmdk-group-heading]]:sr-only"
              >
                {results.map((result) => (
                  <ArchiveResultRow
                    asLink
                    key={result.id}
                    needle={needle}
                    onSelect={(selected) => {
                      // Pointer clicks follow the link itself; only Enter from the input navigates here.
                      if (!selectingByKeyboard.current) return;
                      selectingByKeyboard.current = false;
                      router.push(selected.href as Route);
                    }}
                    result={result}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          ) : null}
        </Command>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t.filters} className="flex flex-wrap gap-2">
          {kinds.map((kind) => {
            const selected = kind === state.type;
            return (
              <Link
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                  selected
                    ? "border-[#18312a] bg-[#18312a] text-white"
                    : "border-[rgb(24_49_42/28%)] bg-[#fffaf0] text-[#18312a] hover:bg-[#dceadb]",
                )}
                href={searchHref(locale, { q: state.q, type: kind }) as Route}
                key={kind}
                replace
                scroll={false}
              >
                {t.kinds[kind]}
                {state.q ? <span className={selected ? "text-white/75" : "text-[#486158]"}>{counts[kind]}</span> : null}
              </Link>
            );
          })}
        </nav>
        <p aria-live="polite" className="text-sm text-[#486158]" role="status">
          {pending ? t.searching : state.q ? t.count(results.length, state.q) : null}
        </p>
      </div>

      {results.length ? null : <EmptyState locale={locale} state={state} total={counts.all} />}
    </div>
  );
}

function EmptyState({ locale, state, total }: { locale: PublicLocale; state: SearchQueryState; total: number }) {
  const t = copy[locale];
  return (
    <div className="grid gap-4 rounded-[1.5rem] border border-dashed border-[rgb(24_49_42/30%)] bg-[rgb(255_250_240/70%)] p-5 sm:p-8">
      {state.q ? (
        <>
          <p className="text-base font-semibold">{t.noResults(state.q)}</p>
          {state.type !== "all" && total ? (
            <Link
              className="w-fit font-semibold text-[#0d513b] underline underline-offset-4"
              href={searchHref(locale, { q: state.q, type: "all" }) as Route}
            >
              {t.otherKinds(total)}
            </Link>
          ) : (
            <p className="text-sm leading-6 text-[#486158]">{t.noResultsHint}</p>
          )}
        </>
      ) : (
        <p className="text-sm leading-6 text-[#486158]">{t.startHint}</p>
      )}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#0d513b]">{t.browse}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["pandas", "families", "map"] as const).map((path) => (
            <Link
              className="inline-flex min-h-11 items-center rounded-full border border-[rgb(24_49_42/28%)] px-4 text-sm font-semibold hover:bg-[#dceadb]"
              href={`/${locale}/${path}` as Route}
              key={path}
            >
              {t.browseLinks[path]}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
