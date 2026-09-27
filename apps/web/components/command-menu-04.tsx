"use client";

/**
 * Registry source: blocks.so command-menu-04.
 * Adapted to PandaAtlas entity search while preserving the registry block's
 * command-dialog, filter row, keyboard navigation, and result-row structure.
 */

import { Command as CommandPrimitive } from "cmdk";
import {
  Library,
  MapPin,
  PawPrint,
  Search,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type ArchiveSearchKind = "panda" | "family" | "place" | "collection";

export interface ArchiveSearchResult {
  id: string;
  kind: ArchiveSearchKind;
  title: string;
  snippet: string;
  meta?: string | null;
  href: string;
}

type Filter = "all" | ArchiveSearchKind;

const kindIcons: Record<ArchiveSearchKind, LucideIcon> = {
  panda: PawPrint,
  family: Users,
  place: MapPin,
  collection: Library,
};

export function ArchiveSearch({
  locale,
  results,
  triggerLabel,
  compact = false,
}: {
  locale: "zh" | "en";
  results: ArchiveSearchResult[];
  triggerLabel: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "border-0 bg-transparent text-[var(--pa-color-ink)] hover:bg-[var(--pa-color-surface-subtle)]",
          compact
            ? "h-9 min-w-9 gap-1.5 px-1.5 !text-[13px]"
            : "h-11 min-w-11 gap-2 px-2",
        )}
        aria-label={triggerLabel}
      >
        <Search className={compact ? "size-3.5" : "size-4"} aria-hidden="true" />
        <span className="hidden xl:inline">{triggerLabel}</span>
      </Button>

      <GlobalArchiveSearch
        locale={locale}
        open={open}
        onOpenChange={setOpen}
        onSelect={(result) => {
          setOpen(false);
          router.push(result.href as Route);
        }}
        results={results}
      />
    </>
  );
}

export function GlobalArchiveSearch({
  locale,
  open,
  onOpenChange,
  onSelect,
  results,
}: {
  locale: "zh" | "en";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (result: ArchiveSearchResult) => void;
  results: ArchiveSearchResult[];
}) {
  const zh = locale === "zh";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const needle = query.trim().toLocaleLowerCase();
  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: zh ? "全部" : "All" },
    { value: "panda", label: zh ? "熊猫" : "Pandas" },
    { value: "family", label: zh ? "家族" : "Families" },
    { value: "place", label: zh ? "地点" : "Places" },
    { value: "collection", label: zh ? "专题" : "Collections" },
  ];

  const matches = results.filter(
    (result) =>
      (filter === "all" || result.kind === filter)
      && `${result.title} ${result.snippet} ${result.meta ?? ""}`
        .toLocaleLowerCase()
        .includes(needle),
  );

  const reset = () => {
    setQuery("");
    setFilter("all");
  };

  return (
    <CommandDialog
      className="top-1/2 -translate-y-1/2 rounded-[var(--pa-radius-lg)] sm:max-w-[720px]"
      description={zh ? "搜索熊猫、家族、地点和专题" : "Search pandas, families, places, and collections"}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      open={open}
      title={zh ? "搜索熊猫世界" : "Search PandaAtlas"}
    >
      <Command shouldFilter={false}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--pa-color-line)] px-5">
          <Search className="size-4 shrink-0 text-[var(--pa-color-ink-muted)]" aria-hidden="true" />
          <CommandPrimitive.Input
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--pa-color-ink-muted)]"
            onValueChange={setQuery}
            placeholder={zh ? "输入熊猫、家族、地点或专题..." : "Search pandas, families, places, or collections..."}
            value={query}
          />
          {query ? (
            <button
              className="min-h-11 px-2 text-sm text-[var(--pa-color-ink-muted)] hover:text-[var(--pa-color-ink)]"
              onClick={reset}
              type="button"
            >
              {zh ? "清除" : "Clear"}
            </button>
          ) : null}
          <button
            aria-label={zh ? "关闭搜索" : "Close search"}
            className="flex size-11 items-center justify-center rounded-full text-[var(--pa-color-ink-muted)] hover:bg-[var(--pa-color-surface-subtle)] hover:text-[var(--pa-color-ink)]"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <CommandList className="max-h-[28rem] pb-3">
          <div
            aria-label={zh ? "搜索类型筛选" : "Search result filters"}
            className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-[var(--pa-color-line)] bg-[var(--pa-color-canvas)] px-5 py-3"
            role="tablist"
          >
            {filters.map((option) => {
              const selected = option.value === filter;
              return (
                <button
                  aria-selected={selected}
                  className={cn(
                    "min-h-9 whitespace-nowrap rounded-full px-3 text-sm transition-colors",
                    selected
                      ? "bg-[var(--pa-color-ink)] text-white"
                      : "text-[var(--pa-color-ink-muted)] hover:bg-[var(--pa-color-surface-subtle)] hover:text-[var(--pa-color-ink)]",
                  )}
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  role="tab"
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <CommandEmpty>{zh ? `没有找到“${query}”` : `No results for “${query}”`}</CommandEmpty>

          <CommandGroup
            heading={needle ? (zh ? "搜索结果" : "Search results") : (zh ? "从这里开始" : "Start here")}
            className="p-0 **:[[cmdk-group-heading]]:px-5 **:[[cmdk-group-heading]]:py-3 **:[[cmdk-group-heading]]:font-normal **:[[cmdk-group-heading]]:text-sm"
          >
            {(needle ? matches : results.slice(0, 10)).map((result) => (
              <ArchiveResultRow key={result.id} result={result} needle={needle} onSelect={onSelect} />
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function ArchiveResultRow({
  result,
  needle,
  onSelect,
}: {
  result: ArchiveSearchResult;
  needle?: string;
  onSelect: (result: ArchiveSearchResult) => void;
}) {
  const Icon = kindIcons[result.kind];

  return (
    <CommandItem
      className="mx-2 min-h-14 gap-3 rounded-[var(--pa-radius-md)] px-3 py-2 text-sm"
      onSelect={() => onSelect(result)}
      value={result.id}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--pa-color-surface-subtle)] text-[var(--pa-color-ink-muted)]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-5 text-[var(--pa-color-ink)]">
          <Highlight needle={needle} text={result.title} />
        </span>
        <span className="block truncate pt-0.5 text-[var(--pa-color-ink-muted)]">
          <Highlight needle={needle} text={result.snippet} />
        </span>
      </span>
      {result.meta ? (
        <span className="hidden shrink-0 pl-4 text-xs text-[var(--pa-color-ink-muted)] sm:block">
          {result.meta}
        </span>
      ) : null}
    </CommandItem>
  );
}

function Highlight({ text, needle }: { text: string; needle?: string }) {
  const start = needle ? text.toLocaleLowerCase().indexOf(needle) : -1;
  if (!needle || start === -1) return text;
  const end = start + needle.length;

  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-transparent font-semibold text-[var(--pa-color-ink)]">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}
