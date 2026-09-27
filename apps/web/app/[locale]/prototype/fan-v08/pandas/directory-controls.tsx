"use client";

import * as React from "react";
import { Check, MapPin, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { BlurFade } from "@/components/registry/magicui/blur-fade";
import { NumberTicker } from "@/components/registry/magicui/number-ticker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import styles from "./directory.module.css";

export type BrowseMode = "all" | "photos" | "alive";

export interface AdvancedFilters {
  gender: "all" | "female" | "male";
  status: "all" | "alive" | "deceased";
  photo: "all" | "with" | "without";
  birthFrom: string;
  birthTo: string;
  location: string;
}

interface DirectoryControlsProps {
  locale: "zh" | "en";
  query: string;
  mode: BrowseMode;
  filteredCount: number;
  advanced: AdvancedFilters;
  activeAdvancedCount: number;
  locationOptions: string[];
  onQueryChange: (value: string) => void;
  onModeChange: (value: BrowseMode) => void;
  onAdvancedChange: (value: AdvancedFilters) => void;
  onClearAll: () => void;
}

export function DirectoryControls({
  locale,
  query,
  mode,
  filteredCount,
  advanced,
  activeAdvancedCount,
  locationOptions,
  onQueryChange,
  onModeChange,
  onAdvancedChange,
  onClearAll,
}: DirectoryControlsProps) {
  const zh = locale === "zh";
  const modes: Array<{ id: BrowseMode; label: string }> = [
    { id: "all", label: zh ? "全部" : "All" },
    { id: "alive", label: zh ? "在世" : "Living" },
    { id: "photos", label: zh ? "有照片" : "With photo" },
  ];

  const patchAdvanced = <K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) => {
    onAdvancedChange({ ...advanced, [key]: value });
  };

  const fields = (
    <FilterFields
      locale={locale}
      advanced={advanced}
      locationOptions={locationOptions}
      onPatch={patchAdvanced}
    />
  );

  return (
    <section className={styles.discoveryRail} id="directory-search" aria-label={zh ? "寻找熊猫" : "Find pandas"}>
      <div className={styles.discoveryShell}>
        <BlurFade className={styles.discoverySurface} direction="down" offset={5} duration={0.36}>
          <InputGroup className={styles.searchLine}>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              aria-label={zh ? "按名字搜索熊猫" : "Search pandas by name"}
              placeholder={zh ? "搜索名字、英文名、地点或标识" : "Search name, alternate name, place, or identifier"}
            />
            <InputGroupAddon align="end">
              <InputGroupText className={styles.resultCount} aria-live="polite">
                <NumberTicker value={filteredCount} locale={zh ? "zh-CN" : "en-US"} />
                <span>{zh ? "只" : "pandas"}</span>
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>

          <div className={styles.modeRow}>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(value) => value && onModeChange(value as BrowseMode)}
              aria-label={zh ? "快速筛选" : "Quick filters"}
              className={styles.quickToggleGroup}
              itemClassName={styles.quickToggleItem}
            >
              {modes.map((item) => (
                <ToggleGroupItem key={item.id} value={item.id}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className={styles.filterDesktop}>
              <Sheet>
                <SheetTrigger asChild>
                  <FilterTrigger zh={zh} activeCount={activeAdvancedCount} />
                </SheetTrigger>
                <SheetContent side="right" className={styles.filterSheet}>
                  <SheetHeader className={styles.filterHeader}>
                    <div className={styles.filterTitleRow}>
                      <SheetTitle>{zh ? "筛选熊猫" : "Filter pandas"}</SheetTitle>
                      {activeAdvancedCount ? (
                        <Badge className={styles.activeFilterBadge}>
                          {zh ? `${activeAdvancedCount} 项已启用` : `${activeAdvancedCount} active`}
                        </Badge>
                      ) : null}
                    </div>
                  </SheetHeader>

                  <div className={styles.filterBody}>{fields}</div>

                  <div className={styles.filterFooter}>
                    <Button type="button" variant="outline" onClick={onClearAll}>
                      <RotateCcw aria-hidden="true" />
                      {zh ? "清除全部" : "Clear all"}
                    </Button>
                    <SheetClose asChild>
                      <Button type="button">
                        {zh ? "查看 " : "View "}
                        <NumberTicker value={filteredCount} locale={zh ? "zh-CN" : "en-US"} />
                        {zh ? " 只" : ""}
                      </Button>
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className={styles.filterMobile}>
              <Drawer>
                <DrawerTrigger asChild>
                  <FilterTrigger zh={zh} activeCount={activeAdvancedCount} />
                </DrawerTrigger>
                <DrawerContent className={styles.filterDrawer}>
                  <DrawerHeader className={styles.drawerHeader}>
                    <div className={styles.filterTitleRow}>
                      <DrawerTitle>{zh ? "筛选熊猫" : "Filter pandas"}</DrawerTitle>
                      {activeAdvancedCount ? (
                        <Badge className={styles.activeFilterBadge}>
                          {zh ? `${activeAdvancedCount} 项` : `${activeAdvancedCount} active`}
                        </Badge>
                      ) : null}
                    </div>
                    <DrawerDescription className={styles.drawerDescription}>
                      {zh ? "按状态、性别、年份和地点缩小范围。" : "Narrow the directory by status, sex, year, and place."}
                    </DrawerDescription>
                  </DrawerHeader>

                  <div className={styles.drawerBody}>{fields}</div>

                  <DrawerFooter className={styles.drawerFooter}>
                    <Button type="button" variant="outline" onClick={onClearAll}>
                      <RotateCcw aria-hidden="true" />
                      {zh ? "清除全部" : "Clear all"}
                    </Button>
                    <DrawerClose asChild>
                      <Button type="button">
                        {zh ? "查看 " : "View "}
                        <NumberTicker value={filteredCount} locale={zh ? "zh-CN" : "en-US"} />
                        {zh ? " 只" : ""}
                      </Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}

const FilterTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    zh: boolean;
    activeCount: number;
  }
>(({ zh, activeCount, className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(styles.precisionLink, className)}
      aria-label={zh ? "更多筛选" : "More filters"}
      {...props}
    >
      <SlidersHorizontal aria-hidden="true" />
      <span className={styles.filterTriggerLabel}>{zh ? "更多筛选" : "More filters"}</span>
      {activeCount ? <span className={styles.filterTriggerCount}>{activeCount}</span> : null}
    </button>
  );
});
FilterTrigger.displayName = "FilterTrigger";

function FilterFields({
  locale,
  advanced,
  locationOptions,
  onPatch,
}: {
  locale: "zh" | "en";
  advanced: AdvancedFilters;
  locationOptions: string[];
  onPatch: <K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) => void;
}) {
  const zh = locale === "zh";

  return (
    <>
      <FilterChoice
        label={zh ? "性别" : "Gender"}
        value={advanced.gender}
        items={[
          ["all", zh ? "全部" : "All"],
          ["female", zh ? "雌性" : "Female"],
          ["male", zh ? "雄性" : "Male"],
        ]}
        onChange={(value) => onPatch("gender", value as AdvancedFilters["gender"])}
      />
      <FilterChoice
        label={zh ? "状态" : "Status"}
        value={advanced.status}
        items={[
          ["all", zh ? "全部" : "All"],
          ["alive", zh ? "在世" : "Living"],
          ["deceased", zh ? "历史档案" : "Historic"],
        ]}
        onChange={(value) => onPatch("status", value as AdvancedFilters["status"])}
      />
      <FilterChoice
        label={zh ? "照片" : "Photo"}
        value={advanced.photo}
        items={[
          ["all", zh ? "不限" : "Any"],
          ["with", zh ? "有照片" : "With photo"],
          ["without", zh ? "暂无照片" : "No photo"],
        ]}
        onChange={(value) => onPatch("photo", value as AdvancedFilters["photo"])}
      />

      <div className={styles.filterGroup}>
        <span>{zh ? "出生年份" : "Birth year"}</span>
        <div className={styles.yearRange}>
          <label>
            <span>{zh ? "从" : "From"}</span>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              value={advanced.birthFrom}
              onChange={(event) => onPatch("birthFrom", event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1980"
              className={styles.filterInput}
            />
          </label>
          <label>
            <span>{zh ? "到" : "To"}</span>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              value={advanced.birthTo}
              onChange={(event) => onPatch("birthTo", event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="2026"
              className={styles.filterInput}
            />
          </label>
        </div>
      </div>

      <div className={styles.filterGroup}>
        <span>{zh ? "地点" : "Place"}</span>
        <Command className={styles.locationCommand} shouldFilter>
          <CommandInput
            value={advanced.location}
            onValueChange={(value) => onPatch("location", value)}
            placeholder={zh ? "搜索成都、上野、华盛顿…" : "Search Chengdu, Ueno, Washington…"}
          />
          <CommandList className={styles.locationList}>
            <CommandEmpty>{zh ? "没有匹配地点" : "No matching place"}</CommandEmpty>
            <CommandGroup heading={zh ? "可用地点" : "Available places"}>
              {locationOptions.map((location) => (
                <CommandItem
                  key={location}
                  value={location}
                  onSelect={() => onPatch("location", advanced.location === location ? "" : location)}
                >
                  <MapPin aria-hidden="true" />
                  <span>{location}</span>
                  {advanced.location === location ? <Check className={styles.commandCheck} aria-hidden="true" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </>
  );
}

function FilterChoice({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.filterGroup}>
      <span>{label}</span>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => next && onChange(next)}
        className={styles.filterToggleGroup}
        itemClassName={styles.filterToggleItem}
        aria-label={label}
      >
        {items.map(([id, text]) => (
          <ToggleGroupItem key={id} value={id}>
            {text}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
