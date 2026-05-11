"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { PandaCard } from "@/components/atlas/panda-card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AtlasAgeStage, AtlasPandaCard, AtlasSortOption } from "@/lib/atlas-presenters";

type AgeFilter = "all" | AtlasAgeStage;
type GenderFilter = "all" | AtlasPandaCard["gender"];

interface AtlasBrowserProps {
  items: AtlasPandaCard[];
}

interface FilterChip {
  key: string;
  label: string;
  clear: () => void;
}

const ageOptions: Array<{ value: AgeFilter; label: string }> = [
  { value: "all", label: "全部年龄阶段" },
  { value: "cub", label: "幼年" },
  { value: "juvenile", label: "青年" },
  { value: "adult", label: "成年" },
  { value: "senior", label: "高龄" },
  { value: "unknown", label: "待补录" },
];

const genderOptions: Array<{ value: GenderFilter; label: string }> = [
  { value: "all", label: "全部性别" },
  { value: "female", label: "雌性" },
  { value: "male", label: "雄性" },
  { value: "unknown", label: "待补录" },
];

const sortOptions: Array<{ value: AtlasSortOption; label: string }> = [
  { value: "recommended", label: "默认推荐" },
  { value: "popular", label: "热门优先" },
  { value: "latest", label: "最新收录" },
  { value: "youngest", label: "最年轻" },
  { value: "oldest", label: "最年长" },
  { value: "name_asc", label: "名称顺序" },
];

const topicPriority = [
  "明星熊猫",
  "温和",
  "活跃",
  "高关注度",
  "爱探索",
  "青年档案",
  "历史档案",
  "国际合作",
  "野外监测",
];

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function buildPagination(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const ordered = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const value = ordered[index];
    const previous = ordered[index - 1];
    if (previous && value - previous > 1) {
      result.push("ellipsis");
    }
    result.push(value);
  }

  return result;
}

export function AtlasBrowser({ items }: AtlasBrowserProps) {
  const [keyword, setKeyword] = useState("");
  const [ageStage, setAgeStage] = useState<AgeFilter>("all");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [location, setLocation] = useState("all");
  const [topic, setTopic] = useState("all");
  const [sort, setSort] = useState<AtlasSortOption>("recommended");
  const [page, setPage] = useState(1);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const deferredKeyword = useDeferredValue(keyword);

  const locationOptions = useMemo(() => {
    return [...new Set(items.map((item) => item.locationShort))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [items]);

  const topicOptions = useMemo(() => {
    const existing = new Set(items.flatMap((item) => item.topics));
    const prioritized = topicPriority.filter((entry) => existing.has(entry));
    const remainder = [...existing]
      .filter((entry) => !topicPriority.includes(entry))
      .sort((a, b) => a.localeCompare(b, "zh-CN"));

    return [...prioritized, ...remainder];
  }, [items]);

  function resetPage() {
    setPage(1);
  }

  function clearFilters() {
    setKeyword("");
    setAgeStage("all");
    setGender("all");
    setLocation("all");
    setTopic("all");
    setSort("recommended");
    setPage(1);
  }

  const filteredItems = useMemo(() => {
    const normalizedKeyword = deferredKeyword.trim().toLowerCase();

    const rows = items.filter((item) => {
      if (ageStage !== "all" && item.ageStage !== ageStage) {
        return false;
      }
      if (gender !== "all" && item.gender !== gender) {
        return false;
      }
      if (location !== "all" && item.locationShort !== location) {
        return false;
      }
      if (topic !== "all" && !item.topics.includes(topic)) {
        return false;
      }
      if (normalizedKeyword && !item.searchText.includes(normalizedKeyword)) {
        return false;
      }
      return true;
    });

    rows.sort((left, right) => {
      if (sort === "popular") {
        return right.popularity - left.popularity || left.nameZh.localeCompare(right.nameZh, "zh-CN");
      }
      if (sort === "latest") {
        return (right.birthDate ?? "").localeCompare(left.birthDate ?? "") || left.nameZh.localeCompare(right.nameZh, "zh-CN");
      }
      if (sort === "youngest") {
        return (left.ageYears ?? Number.MAX_SAFE_INTEGER) - (right.ageYears ?? Number.MAX_SAFE_INTEGER) || left.nameZh.localeCompare(right.nameZh, "zh-CN");
      }
      if (sort === "oldest") {
        return (right.ageYears ?? -1) - (left.ageYears ?? -1) || left.nameZh.localeCompare(right.nameZh, "zh-CN");
      }
      if (sort === "name_asc") {
        return left.nameZh.localeCompare(right.nameZh, "zh-CN");
      }
      return (
        Number(right.featured) - Number(left.featured) ||
        right.popularity - left.popularity ||
        (right.birthDate ?? "").localeCompare(left.birthDate ?? "") ||
        left.nameZh.localeCompare(right.nameZh, "zh-CN")
      );
    });

    return rows;
  }, [ageStage, deferredKeyword, gender, items, location, sort, topic]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredItems.length / 9)));
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / 9));
  const pagedItems = filteredItems.slice((currentPage - 1) * 9, currentPage * 9);
  const pagination = buildPagination(currentPage, totalPages);

  const activeFilters: FilterChip[] = (() => {
    const chips: FilterChip[] = [];

    if (keyword.trim()) {
      chips.push({
        key: "keyword",
        label: `搜索：${keyword.trim()}`,
        clear: () => {
          setKeyword("");
          resetPage();
        },
      });
    }
    if (location !== "all") {
      chips.push({
        key: "location",
        label: `地点：${location}`,
        clear: () => {
          setLocation("all");
          resetPage();
        },
      });
    }
    if (ageStage !== "all") {
      chips.push({
        key: "age",
        label: ageOptions.find((item) => item.value === ageStage)?.label ?? ageStage,
        clear: () => {
          setAgeStage("all");
          resetPage();
        },
      });
    }
    if (gender !== "all") {
      chips.push({
        key: "gender",
        label: genderOptions.find((item) => item.value === gender)?.label ?? gender,
        clear: () => {
          setGender("all");
          resetPage();
        },
      });
    }
    if (topic !== "all") {
      chips.push({
        key: "topic",
        label: `专题：${topic}`,
        clear: () => {
          setTopic("all");
          resetPage();
        },
      });
    }

    return chips;
  })();

  const summaryLine =
    activeFilters.length > 0
      ? `当前筛选：${activeFilters.map((item) => item.label).join(" · ")}`
      : "当前按默认推荐浏览全部档案。";
  const rangeStart = filteredItems.length === 0 ? 0 : (currentPage - 1) * 9 + 1;
  const rangeEnd = Math.min(currentPage * 9, filteredItems.length);

  return (
    <div className="space-y-8" data-testid="atlas-browser">
      <section className="rounded-[1.7rem] border border-[rgba(47,92,69,0.06)] bg-white p-5 shadow-[0_10px_26px_rgba(30,44,31,0.04)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_repeat(2,minmax(0,0.9fr))_auto]">
          <label className="relative block">
            <span className="mb-2 block text-xs font-semibold tracking-[0.2em] text-[rgba(63,125,71,0.72)]">搜索</span>
            <Search className="pointer-events-none absolute left-4 top-[calc(50%+12px)] h-4 w-4 -translate-y-1/2 text-[rgba(63,125,71,0.7)]" />
            <Input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                resetPage();
              }}
              placeholder="搜索熊猫名字、基地或关键词"
              className="h-12 rounded-[1rem] border-0 bg-[var(--bg)] pl-11 shadow-none"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold tracking-[0.2em] text-[rgba(63,125,71,0.72)]">地点</span>
            <Select
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                resetPage();
              }}
              className="h-12 rounded-[1rem] border-0 bg-[var(--bg)] shadow-none"
            >
              <option value="all">全部地点</option>
              {locationOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold tracking-[0.2em] text-[rgba(63,125,71,0.72)]">年龄阶段</span>
            <Select
              value={ageStage}
              onChange={(event) => {
                setAgeStage(event.target.value as AgeFilter);
                resetPage();
              }}
              className="h-12 rounded-[1rem] border-0 bg-[var(--bg)] shadow-none"
            >
              {ageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setShowMoreFilters((current) => !current)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1rem] border border-[rgba(47,92,69,0.08)] bg-[rgba(247,245,239,0.92)] px-4 text-sm font-semibold text-[var(--fg)] transition hover:border-[rgba(63,125,71,0.2)] hover:text-[var(--accent)]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              更多筛选
            </button>
          </div>
        </div>

        {showMoreFilters ? (
          <div className="mt-4 grid gap-3 border-t border-[rgba(47,92,69,0.08)] pt-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold tracking-[0.2em] text-[rgba(63,125,71,0.72)]">性别</span>
              <Select
                value={gender}
                onChange={(event) => {
                  setGender(event.target.value as GenderFilter);
                  resetPage();
                }}
                className="h-12 rounded-[1rem] border-0 bg-[var(--bg)] shadow-none"
              >
                {genderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold tracking-[0.2em] text-[rgba(63,125,71,0.72)]">专题标签</span>
              <Select
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value);
                  resetPage();
                }}
                className="h-12 rounded-[1rem] border-0 bg-[var(--bg)] shadow-none"
              >
                <option value="all">全部专题标签</option>
                {topicOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        ) : null}

        {activeFilters.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[rgba(47,92,69,0.08)] pt-4">
            {activeFilters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.clear}
                className="rounded-full border border-[rgba(47,92,69,0.08)] bg-[rgba(247,245,239,0.92)] px-3 py-1.5 text-sm text-[var(--fg)] transition hover:bg-[rgba(63,125,71,0.08)]"
              >
                {item.label}
              </button>
            ))}

            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(63,125,71,0.08)]"
            >
              重置筛选
            </button>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.24em] text-[rgba(63,125,71,0.72)]">浏览结果</p>
          <h2 className="mt-3 text-[1.9rem] font-bold text-[var(--fg)] sm:text-[2.15rem]">{formatCount(filteredItems.length)} 份档案</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{summaryLine}</p>
        </div>

        <label className="block md:min-w-[220px]">
          <span className="mb-2 block text-xs font-semibold tracking-[0.2em] text-[rgba(63,125,71,0.72)]">排序</span>
          <Select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as AtlasSortOption);
              resetPage();
            }}
            className="h-11 rounded-[1rem] border border-[rgba(47,92,69,0.08)] bg-white shadow-[0_10px_20px_rgba(30,44,31,0.04)]"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </section>

      {filteredItems.length === 0 ? (
        <section className="rounded-[1.7rem] border border-dashed border-[rgba(47,92,69,0.12)] bg-white px-6 py-12 text-center">
          <h3 className="text-[1.45rem] text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>
            没有找到符合条件的档案
          </h3>
          <p className="mt-3 text-sm leading-8 text-[var(--muted)]">试着减少筛选条件，或重置后重新浏览全部档案。</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#33663a]"
          >
            重置筛选
          </button>
        </section>
      ) : (
        <>
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pagedItems.map((panda, index) => (
              <div key={panda.id} className="home-fade-up" style={{ animationDelay: `${index * 70}ms` }}>
                <PandaCard panda={panda} />
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-4 pt-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex h-11 items-center justify-center gap-1 rounded-full border border-[rgba(47,92,69,0.08)] bg-white px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[rgba(63,125,71,0.2)] hover:text-[var(--accent)] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </button>

              {pagination.map((entry, index) =>
                entry === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-sm text-[var(--muted)]">
                    ...
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setPage(entry)}
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition ${
                      currentPage === entry
                        ? "bg-[var(--accent)] text-white shadow-[0_14px_26px_rgba(63,125,71,0.18)]"
                        : "border border-[rgba(47,92,69,0.08)] bg-white text-[var(--fg)] hover:border-[rgba(63,125,71,0.2)] hover:text-[var(--accent)]"
                    }`}
                  >
                    {entry}
                  </button>
                )
              )}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="inline-flex h-11 items-center justify-center gap-1 rounded-full border border-[rgba(47,92,69,0.08)] bg-white px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[rgba(63,125,71,0.2)] hover:text-[var(--accent)] disabled:opacity-40"
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <p className="text-center text-sm text-[var(--muted)]">
              显示 {rangeStart}-{rangeEnd} 条，共 {formatCount(filteredItems.length)} 条结果
            </p>
          </section>
        </>
      )}
    </div>
  );
}
