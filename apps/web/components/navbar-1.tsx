"use client";

/* eslint-disable @next/next/no-img-element -- the prototype navigation uses reviewed remote panda media. */

import { ArrowRight, ChevronDown, Heart, Menu } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu as NavigationMenuPrimitive } from "radix-ui";
import { useState, type CSSProperties } from "react";

import { ZhiPandaLogo } from "@/components/brand/zhipanda-logo";
import { ArchiveSearch, type ArchiveSearchResult } from "@/components/command-menu-04";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  description: string;
  href: string;
};

type NavSection = {
  label: string;
  href: string;
  items?: NavItem[];
};

export type NavbarFeature = {
  href: string;
  imageSrc: string;
  name: string;
  meta: string;
};

export function Navbar1({
  locale,
  searchResults,
  immersive = false,
  featuredPandas = [],
}: {
  locale: "zh" | "en";
  searchResults: ArchiveSearchResult[];
  immersive?: boolean;
  featuredPandas?: NavbarFeature[];
}) {
  const zh = locale === "zh";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sections: NavSection[] = [
    {
      label: zh ? "熊猫" : "Pandas",
      href: `/${locale}/prototype/fan-v08/pandas`,
      items: [
        {
          label: zh ? "全部熊猫" : "All pandas",
          description: zh ? "按名字浏览真实熊猫个体" : "Browse named individual pandas",
          href: `/${locale}/prototype/fan-v08/pandas`,
        },
        {
          label: zh ? "发现熊猫" : "Discover",
          description: zh ? "用照片继续认识下一只熊猫" : "Meet another panda through photography",
          href: `/${locale}/pandas/discover`,
        },
        {
          label: zh ? "随机认识一只" : "Meet one at random",
          description: zh ? "不知道从谁开始时，就从这里开始" : "A simple way to start somewhere new",
          href: `/${locale}/games/random`,
        },
      ],
    },
    {
      label: zh ? "家族" : "Families",
      href: `/${locale}/families`,
      items: [
        {
          label: zh ? "家族总览" : "Family overview",
          description: zh ? "从亲缘关系继续认识更多熊猫" : "Continue through real family relationships",
          href: `/${locale}/families`,
        },
        {
          label: zh ? "美香家族" : "Smithsonian family",
          description: zh ? "从美香一家看跨代关系" : "Explore the Smithsonian generations",
          href: `/${locale}/families/smithsonian-generations`,
        },
        {
          label: zh ? "上野双胞胎" : "Ueno twins",
          description: zh ? "晓晓与蕾蕾的家族故事" : "Xiao Xiao and Lei Lei's family",
          href: `/${locale}/families/ueno-twins`,
        },
      ],
    },
    {
      label: zh ? "地点" : "Places",
      href: `/${locale}/map`,
    },
    {
      label: zh ? "故事" : "Stories",
      href: `/${locale}/moments`,
      items: [
        {
          label: zh ? "熊猫时刻" : "Panda moments",
          description: zh ? "照片、近况和生命中的重要时刻" : "Photos, updates and life moments",
          href: `/${locale}/moments`,
        },
        {
          label: zh ? "我的动态" : "My feed",
          description: zh ? "回到你关心的熊猫最近发生的事" : "Return to updates from pandas you follow",
          href: `/${locale}/me/feed`,
        },
      ],
    },
  ];

  const immersiveVars = {
    "--pa-color-canvas": "var(--zp-brand-ivory)",
    "--pa-color-surface": "var(--zp-brand-ivory)",
    "--pa-color-surface-subtle": "#f2f0e6",
    "--pa-color-ink": "var(--zp-brand-ink)",
    "--pa-color-ink-muted": "#60716b",
    "--pa-color-line": "#d8ddd6",
    "--pa-color-accent": "var(--zp-brand-acid)",
    "--pa-color-accent-strong": "var(--zp-brand-acid)",
  } as CSSProperties;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        "z-50 w-full",
        immersive
          ? "pointer-events-none fixed inset-x-0 top-0"
          : "sticky top-0 border-b border-[var(--pa-color-line)] bg-[color:color-mix(in_srgb,var(--pa-color-canvas)_96%,transparent)] backdrop-blur-md",
      )}
    >
      <div
        className={cn(
          immersive
            ? "pointer-events-auto mx-auto mt-3 flex h-[50px] w-[calc(100%_-_3rem)] max-w-[1280px] items-center gap-3 rounded-full bg-[var(--zp-brand-ivory)] px-3.5 shadow-[var(--zp-shadow-float)] sm:px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4"
            : "mx-auto flex h-16 w-full max-w-[96rem] items-center gap-8 px-4 sm:px-6 lg:px-8",
        )}
        style={immersive ? immersiveVars : undefined}
      >
        <Link
          href={`/${locale}/prototype/fan-v08` as Route}
          className="flex min-h-9 shrink-0 items-center text-[var(--pa-color-ink)] lg:justify-self-start"
          aria-label={zh ? "吱熊猫首页" : "ZhiPanda home"}
        >
          <ZhiPandaLogo locale={locale} />
        </Link>

        <NavigationMenuPrimitive.Root
          delayDuration={90}
          className="relative hidden shrink-0 items-center justify-self-center text-[13px] font-semibold lg:flex"
        >
          <NavigationMenuPrimitive.List className="flex items-center gap-2 xl:gap-3">
            {sections.map((section, sectionIndex) => {
              const feature = featuredPandas[sectionIndex % Math.max(featuredPandas.length, 1)] ?? null;

              return (
              <NavigationMenuPrimitive.Item key={section.href} className="relative">
                {section.items?.length ? (
                  <>
                    <NavigationMenuPrimitive.Trigger
                      className={cn(
                        "group inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[inherit] font-[inherit] text-[var(--pa-color-ink)] outline-none transition-colors hover:bg-[#10352f]/7 focus-visible:bg-[#10352f]/7 data-[state=open]:bg-[#10352f]/7 xl:px-3",
                        isActive(section.href) && "bg-[#10352f]/7",
                      )}
                    >
                      {section.label}
                      <ChevronDown
                        className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                        aria-hidden="true"
                      />
                    </NavigationMenuPrimitive.Trigger>
                    <NavigationMenuPrimitive.Content
                      className={cn(
                        "absolute top-full z-50 mt-3 w-[36rem] overflow-hidden rounded-[1.15rem] border border-[#d8ddd6] bg-[var(--zp-brand-ivory)] p-2.5 shadow-[0_22px_60px_rgba(0,37,38,0.2)]",
                        section.label === (zh ? "故事" : "Stories") ? "right-0" : "left-0",
                      )}
                    >
                      <div className={cn("grid gap-2", feature ? "grid-cols-[1.05fr_.95fr]" : "grid-cols-1")}>
                        <div className="min-w-0">
                          <div className="border-b border-[#d8ddd6] px-3 pb-2.5 pt-1.5">
                            <Link
                              href={section.href as Route}
                              className="inline-flex items-center gap-2 text-[13px] font-[780] !text-[#002526]"
                            >
                              {zh ? `查看全部${section.label}` : `View all ${section.label.toLowerCase()}`}
                              <ArrowRight className="size-3.5" aria-hidden="true" />
                            </Link>
                          </div>
                          <div className="grid py-1">
                            {section.items.map((item) => (
                              <NavigationMenuPrimitive.Link key={item.href} asChild>
                                <Link
                                  href={item.href as Route}
                                  className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 !text-[#002526] outline-none transition-colors hover:bg-[#eff0e5] focus-visible:bg-[#eff0e5]"
                                >
                                  <span className="min-w-0">
                                    <strong className="block text-[13px] font-[760] tracking-[-0.01em] !text-[#002526]">
                                      {item.label}
                                    </strong>
                                    <span className="mt-0.5 block text-[11px] leading-[1.45] text-[#60716b]">
                                      {item.description}
                                    </span>
                                  </span>
                                  <ArrowRight
                                    className="size-3.5 text-[#60716b] transition-transform group-hover:translate-x-0.5 group-hover:text-[#002526]"
                                    aria-hidden="true"
                                  />
                                </Link>
                              </NavigationMenuPrimitive.Link>
                            ))}
                          </div>
                        </div>

                        {feature ? (
                          <Link
                            href={feature.href as Route}
                            className="group relative min-h-[15rem] overflow-hidden rounded-[0.9rem] bg-[#0b5353] !text-[#fffff2]"
                          >
                            <img
                              src={feature.imageSrc}
                              alt=""
                              aria-hidden="true"
                              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                            />
                            <span className="absolute inset-0 bg-gradient-to-t from-[#002526]/90 via-[#002526]/18 to-transparent" aria-hidden="true" />
                            <span className="absolute inset-x-4 bottom-4 z-10 grid gap-1">
                              <span className="text-[10px] font-[760] uppercase tracking-[0.12em] text-[#f0f63a]">
                                {zh ? "今天认识" : "Meet a panda"}
                              </span>
                              <strong className="text-lg font-[780] tracking-[-0.025em]">{feature.name}</strong>
                              <span className="text-[11px] leading-[1.45] text-[#fffff2]/72">{feature.meta}</span>
                            </span>
                          </Link>
                        ) : null}
                      </div>
                    </NavigationMenuPrimitive.Content>
                  </>
                ) : (
                  <NavigationMenuPrimitive.Link asChild>
                    <Link
                      href={section.href as Route}
                      aria-current={isActive(section.href) ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-9 items-center rounded-full px-2.5 text-[inherit] font-[inherit] text-[var(--pa-color-ink)] outline-none transition-colors hover:bg-[#10352f]/7 focus-visible:bg-[#10352f]/7 xl:px-3",
                        isActive(section.href) && "bg-[#10352f]/7",
                      )}
                    >
                      {section.label}
                    </Link>
                  </NavigationMenuPrimitive.Link>
                )}
              </NavigationMenuPrimitive.Item>
              );
            })}
          </NavigationMenuPrimitive.List>

        </NavigationMenuPrimitive.Root>

        <div className="ml-auto hidden shrink-0 items-center justify-self-end gap-1 lg:flex">
          <ArchiveSearch
            locale={locale}
            results={searchResults}
            triggerLabel={zh ? "搜索" : "Search"}
            compact={immersive}
          />
          <Link
            href={`/${locale === "zh" ? "en" : "zh"}/prototype/fan-v08` as Route}
            className="inline-flex min-h-9 min-w-9 items-center justify-center px-1.5 text-[11px] font-medium text-[var(--pa-color-ink-muted)] hover:text-[var(--pa-color-ink)]"
          >
            {zh ? "中 / EN" : "EN / 中"}
          </Link>
          <Link
            href={`/${locale}/my-pandas` as Route}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 text-[13px] font-[720]",
              immersive
                ? "rounded-full bg-[var(--zp-brand-acid)] px-3.5 !text-[var(--zp-brand-ink)] hover:bg-[#eff51a]"
                : "px-2 text-[var(--pa-color-ink)]",
            )}
          >
            <Heart className="size-4" aria-hidden="true" />
            {zh ? "我的熊猫" : "My Pandas"}
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <ArchiveSearch
            locale={locale}
            results={searchResults}
            triggerLabel={zh ? "搜索" : "Search"}
          />
          {immersive ? (
            <Link
              href={`/${locale}/my-pandas` as Route}
              className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--zp-brand-acid)] !text-[var(--zp-brand-ink)]"
              aria-label={zh ? "我的熊猫" : "My Pandas"}
            >
              <Heart className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center text-[var(--pa-color-ink)] lg:hidden"
              aria-label={zh ? "打开导航" : "Open navigation"}
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="h-dvh max-h-dvh rounded-none border-0 bg-[#003e40] px-0 pb-6 text-[#fffff2]"
          >
            <SheetHeader className="border-b border-[#fffff2]/14 px-6 pb-5 pt-7 text-left">
              <SheetTitle className="text-xl font-[760] tracking-[-0.025em] text-[#fffff2]">
                {zh ? "吱熊猫 ZhiPanda" : "ZhiPanda"}
              </SheetTitle>
            </SheetHeader>

            <nav className="px-5 pt-3" aria-label={zh ? "移动导航" : "Mobile navigation"}>
              {sections.map((section) => (
                <div key={section.href} className="border-b border-[#fffff2]/14 py-1">
                  <SheetClose asChild>
                    <Link
                      href={section.href as Route}
                      className="grid min-h-16 grid-cols-[1fr_auto] items-center px-1 text-[#fffff2]"
                    >
                      <strong className="text-[clamp(1.8rem,8vw,2.6rem)] font-[720] tracking-[-0.035em]">
                        {section.label}
                      </strong>
                      <span className="text-[#f0f63a]" aria-hidden="true">↗</span>
                    </Link>
                  </SheetClose>
                  {section.items?.length ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pb-3">
                      {section.items.slice(0, 2).map((item) => (
                        <SheetClose key={item.href} asChild>
                          <Link
                            href={item.href as Route}
                            className="inline-flex min-h-9 items-center text-xs font-medium text-[#fffff2]/64"
                          >
                            {item.label}
                          </Link>
                        </SheetClose>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}

              <div className="mt-6 flex items-center justify-between gap-3 px-1">
                <SheetClose asChild>
                  <Link
                    href={`/${locale}/my-pandas` as Route}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--zp-brand-acid)] px-5 text-sm font-[760] !text-[var(--zp-brand-ink)]"
                  >
                    <Heart className="size-4" aria-hidden="true" />
                    {zh ? "我的熊猫" : "My Pandas"}
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href={`/${locale === "zh" ? "en" : "zh"}/prototype/fan-v08` as Route}
                    className="inline-flex min-h-12 items-center text-sm text-[#fffff2]/68"
                  >
                    {zh ? "English" : "中文"}
                  </Link>
                </SheetClose>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

export default Navbar1;
