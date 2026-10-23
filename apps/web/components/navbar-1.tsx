"use client";

/* eslint-disable @next/next/no-img-element -- the prototype navigation uses reviewed remote panda media. */

import { ArrowRight, Bell, ChevronDown, Heart, Menu } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NavigationMenu as NavigationMenuPrimitive } from "radix-ui";
import { useState } from "react";

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
  // Other path prefixes that belong to this section, for the active state.
  matches?: string[];
  items?: NavItem[];
};

export type NavbarFeature = {
  href: string;
  imageSrc: string;
  name: string;
  meta: string;
};

// Each public route has the same path in both locales, so the language switch keeps the
// current path and query and only swaps the locale segment.
function alternateLanguageHref(locale: "zh" | "en", pathname: string, search: string) {
  const otherLocale = locale === "zh" ? "en" : "zh";
  const rest = pathname.replace(/^\/(zh|en)(?=\/|$)/, "");
  return `/${otherLocale}${rest}${search ? `?${search}` : ""}`;
}

export function Navbar1({
  locale,
  searchResults,
  featuredPandas = [],
  contributeEnabled = false,
  notificationsEnabled = false,
}: {
  locale: "zh" | "en";
  searchResults: ArchiveSearchResult[];
  featuredPandas?: NavbarFeature[];
  contributeEnabled?: boolean;
  notificationsEnabled?: boolean;
}) {
  const zh = locale === "zh";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const languageDestination = alternateLanguageHref(locale, pathname, searchParams.toString());
  const languageHrefLang = zh ? "en" : "zh-CN";
  const [open, setOpen] = useState(false);

  const sections: NavSection[] = [
    {
      label: zh ? "熊猫" : "Pandas",
      href: `/${locale}/pandas`,
      items: [
        {
          label: zh ? "全部熊猫" : "All pandas",
          description: zh ? "按名字浏览真实熊猫个体" : "Browse named individual pandas",
          href: `/${locale}/pandas`,
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
        {
          label: zh ? "熊猫游戏" : "Panda games",
          description: zh ? "猜熊猫、认熊猫，玩着记住它们" : "Guess and match pandas to remember them",
          href: `/${locale}/games`,
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
      matches: [`/${locale}/places`],
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
        ...(contributeEnabled ? [{
          label: zh ? "纠错与贡献" : "Contribute",
          description: zh ? "补充资料或指出需要更正的地方" : "Add material or point out a correction",
          href: `/${locale}/contribute`,
        }] : []),
      ],
    },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const isSectionActive = (section: NavSection) =>
    [section.href, ...(section.matches ?? [])].some(isActive);

  return (
    <header className="sticky top-0 z-50 w-full bg-[color:color-mix(in_srgb,var(--pa-color-canvas)_94%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex min-h-[4.5rem] w-[min(var(--pa-content-max),calc(100%-2*var(--pa-space-page)))] items-center gap-4 lg:gap-8">
        <Link
          href={`/${locale}` as Route}
          className="flex min-h-11 shrink-0 items-center text-[var(--pa-color-ink)]"
          aria-label={zh ? "吱熊猫首页" : "ZhiPanda home"}
        >
          <ZhiPandaLogo locale={locale} />
        </Link>

        <NavigationMenuPrimitive.Root
          delayDuration={90}
          aria-label={zh ? "主导航" : "Primary navigation"}
          className="relative hidden min-w-0 items-center text-[0.9375rem] font-medium lg:flex"
        >
          <NavigationMenuPrimitive.List className="flex items-center gap-1">
            {sections.map((section, sectionIndex) => {
              const feature = featuredPandas[sectionIndex % Math.max(featuredPandas.length, 1)] ?? null;
              const itemClass = cn(
                "group inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[inherit] font-[inherit] text-[var(--pa-color-ink-muted)] outline-none transition-colors hover:text-[var(--pa-color-ink)] focus-visible:bg-[var(--pa-color-surface-subtle)] data-[state=open]:bg-[var(--pa-color-surface-subtle)] data-[state=open]:text-[var(--pa-color-ink)]",
                isSectionActive(section) && "bg-[var(--pa-color-surface-subtle)] font-semibold text-[var(--pa-color-ink)]",
              );

              return (
              <NavigationMenuPrimitive.Item key={section.href} className="relative">
                {section.items?.length ? (
                  <>
                    <NavigationMenuPrimitive.Trigger className={itemClass}>
                      {section.label}
                      <ChevronDown
                        className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                        aria-hidden="true"
                      />
                    </NavigationMenuPrimitive.Trigger>
                    <NavigationMenuPrimitive.Content
                      className={cn(
                        "absolute top-full z-50 mt-3 w-[36rem] overflow-hidden rounded-[var(--pa-radius-md)] bg-[var(--pa-color-surface)] p-2.5 shadow-[var(--pa-shadow-float)] ring-1 ring-[var(--pa-color-line)]",
                        sectionIndex === sections.length - 1 ? "right-0" : "left-0",
                      )}
                    >
                      <div className={cn("grid gap-2", feature ? "grid-cols-[1.05fr_.95fr]" : "grid-cols-1")}>
                        <div className="min-w-0">
                          <div className="border-b border-[var(--pa-color-line)] px-3 pb-2.5 pt-1.5">
                            <Link
                              href={section.href as Route}
                              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--pa-color-ink)]"
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
                                  className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-[var(--pa-radius-sm)] px-3 py-2.5 text-[var(--pa-color-ink)] outline-none transition-colors hover:bg-[var(--pa-color-surface-subtle)] focus-visible:bg-[var(--pa-color-surface-subtle)]"
                                >
                                  <span className="min-w-0">
                                    <strong className="block text-sm font-semibold">{item.label}</strong>
                                    <span className="mt-0.5 block text-xs leading-[1.45] text-[var(--pa-color-ink-muted)]">
                                      {item.description}
                                    </span>
                                  </span>
                                  <ArrowRight
                                    className="size-3.5 text-[var(--pa-color-ink-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--pa-color-ink)]"
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
                            className="group relative min-h-[15rem] overflow-hidden rounded-[var(--pa-radius-sm)] bg-[var(--pa-color-ink)] text-[var(--pa-color-surface)]"
                          >
                            <img
                              src={feature.imageSrc}
                              alt=""
                              aria-hidden="true"
                              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden="true" />
                            <span className="absolute inset-x-4 bottom-4 z-10 grid gap-1">
                              <span className="text-xs font-medium text-white/75">
                                {zh ? "今天认识" : "Meet a panda"}
                              </span>
                              <strong className="text-lg font-extrabold">{feature.name}</strong>
                              <span className="text-xs leading-[1.45] text-white/75">{feature.meta}</span>
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
                      aria-current={isSectionActive(section) ? "page" : undefined}
                      className={itemClass}
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

        <div className="ml-auto flex items-center gap-2">
          <ArchiveSearch
            locale={locale}
            results={searchResults}
            triggerLabel={zh ? "搜索" : "Search"}
          />
          <Link
            href={languageDestination as Route}
            hrefLang={languageHrefLang}
            aria-label={zh ? "English" : "中文"}
            className="hidden min-h-11 items-center px-2 text-[0.9375rem] font-medium text-[var(--pa-color-ink-muted)] hover:text-[var(--pa-color-ink)] lg:inline-flex"
          >
            {zh ? "EN" : "中文"}
          </Link>
          {notificationsEnabled ? (
            <Link
              href={`/${locale}/me/inbox` as Route}
              className="hidden size-11 items-center justify-center rounded-full bg-[var(--pa-color-surface-subtle)] text-[var(--pa-color-ink)] transition-colors hover:bg-[var(--pa-color-surface-strong)] lg:inline-flex"
              aria-label={zh ? "打开我的通知" : "Open my notifications"}
              title={zh ? "通知" : "Notifications"}
            >
              <Bell className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
          <Link
            href={`/${locale}/me` as Route}
            className="pa-header-cta inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-[var(--pa-color-ink)] px-5 text-sm font-semibold text-[var(--pa-color-surface)] transition hover:bg-[var(--zp-ink-soft)] active:scale-[0.97] max-sm:px-4 max-[25rem]:px-0"
          >
            <Heart className="size-4 shrink-0" aria-hidden="true" />
            <span className="max-[25rem]:sr-only">{zh ? "我的熊猫" : "My Pandas"}</span>
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--pa-color-surface-subtle)] text-[var(--pa-color-ink)] lg:hidden"
                aria-label={zh ? "打开导航" : "Open navigation"}
              >
                <Menu className="size-5" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="h-dvh max-h-dvh rounded-none border-0 bg-[var(--pa-color-surface)] px-0 pb-6 text-[var(--pa-color-ink)]"
            >
              <SheetHeader className="border-b border-[var(--pa-color-line)] px-6 pb-5 pt-7 text-left">
                <SheetTitle className="text-xl font-extrabold text-[var(--pa-color-ink)]">
                  {zh ? "吱熊猫 ZhiPanda" : "ZhiPanda"}
                </SheetTitle>
              </SheetHeader>

              <nav className="px-5 pt-3" aria-label={zh ? "移动导航" : "Mobile navigation"}>
                {sections.map((section) => (
                  <div key={section.href} className="border-b border-[var(--pa-color-line)] py-1">
                    <SheetClose asChild>
                      <Link
                        href={section.href as Route}
                        className="grid min-h-16 grid-cols-[1fr_auto] items-center px-1 text-[var(--pa-color-ink)]"
                      >
                        <strong className="text-[clamp(1.75rem,8vw,2.5rem)] font-black tracking-[-0.02em]">
                          {section.label}
                        </strong>
                        <ArrowRight className="size-5 text-[var(--pa-color-ink-muted)]" aria-hidden="true" />
                      </Link>
                    </SheetClose>
                    {section.items?.length ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pb-3">
                        {section.items.slice(0, 2).map((item) => (
                          <SheetClose key={item.href} asChild>
                            <Link
                              href={item.href as Route}
                              className="inline-flex min-h-9 items-center text-sm text-[var(--pa-color-ink-muted)]"
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
                  {notificationsEnabled ? (
                    <SheetClose asChild>
                      <Link
                        href={`/${locale}/me/inbox` as Route}
                        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--pa-color-surface-subtle)] px-5 text-sm font-semibold"
                      >
                        <Bell className="size-4" aria-hidden="true" />
                        {zh ? "通知" : "Notifications"}
                      </Link>
                    </SheetClose>
                  ) : <span />}
                  <SheetClose asChild>
                    <Link
                      href={languageDestination as Route}
                      hrefLang={languageHrefLang}
                      className="inline-flex min-h-12 items-center text-sm text-[var(--pa-color-ink-muted)]"
                    >
                      {zh ? "English" : "中文"}
                    </Link>
                  </SheetClose>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export default Navbar1;
