"use client";

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
  href: string;
};

type NavSection = {
  label: string;
  href: string;
  // Other path prefixes that belong to this section, for the active state.
  matches?: string[];
  items?: NavItem[];
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
  contributeEnabled = false,
  notificationsEnabled = false,
}: {
  locale: "zh" | "en";
  searchResults: ArchiveSearchResult[];
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
          href: `/${locale}/pandas`,
        },
        {
          label: zh ? "发现熊猫" : "Discover",
          href: `/${locale}/pandas/discover`,
        },
        {
          label: zh ? "随机认识一只" : "Meet one at random",
          href: `/${locale}/games/random`,
        },
        {
          label: zh ? "熊猫游戏" : "Panda games",
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
          href: `/${locale}/families`,
        },
        {
          label: zh ? "美香家族" : "Smithsonian family",
          href: `/${locale}/families/smithsonian-generations`,
        },
        {
          label: zh ? "上野双胞胎" : "Ueno twins",
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
          href: `/${locale}/moments`,
        },
        {
          label: zh ? "我的动态" : "My feed",
          href: `/${locale}/me/feed`,
        },
        ...(contributeEnabled ? [{
          label: zh ? "纠错与贡献" : "Contribute",
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
    <header className="sticky top-0 z-50 w-full border-b-[0.5px] border-[var(--pa-color-line)] bg-[var(--pa-color-canvas)]">
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
          className="relative hidden min-w-0 items-center text-base font-medium lg:flex"
        >
          <NavigationMenuPrimitive.List className="flex items-center gap-1">
            {sections.map((section, sectionIndex) => {
              const itemClass = cn(
                "group inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[inherit] font-[inherit] text-[var(--pa-color-ink-muted)] outline-none transition-colors duration-250 ease-out hover:text-[var(--pa-color-ink)] focus-visible:bg-[var(--pa-color-surface-subtle)] data-[state=open]:bg-[var(--pa-color-surface-subtle)] data-[state=open]:text-[var(--pa-color-ink)]",
                isSectionActive(section) && "bg-[var(--pa-color-surface-subtle)] font-semibold text-[var(--pa-color-ink)]",
              );

              return (
              <NavigationMenuPrimitive.Item key={section.href} className="relative">
                {section.items?.length ? (
                  <>
                    <NavigationMenuPrimitive.Trigger className={itemClass}>
                      {section.label}
                      <ChevronDown
                        className="size-4 transition-transform duration-250 ease-out group-data-[state=open]:rotate-180"
                        aria-hidden="true"
                      />
                    </NavigationMenuPrimitive.Trigger>
                    <NavigationMenuPrimitive.Content
                      className={cn(
                        "absolute top-full z-50 mt-2 w-56 rounded-[var(--pa-radius-lg)] bg-[var(--pa-color-surface)] p-1.5 shadow-[var(--pa-shadow-float)] ring-[0.5px] ring-[var(--pa-color-line-strong)]",
                        sectionIndex === sections.length - 1 ? "right-0" : "left-0",
                      )}
                    >
                      <ul className="grid">
                        {section.items.map((item) => (
                          <li key={item.href}>
                            <NavigationMenuPrimitive.Link asChild>
                              <Link
                                href={item.href as Route}
                                className="flex min-h-10 items-center rounded-[calc(var(--pa-radius-lg)-0.375rem)] px-3 text-[var(--pa-color-ink)] outline-none hover:bg-[var(--pa-color-surface-subtle)] focus-visible:bg-[var(--pa-color-surface-subtle)]"
                              >
                                {item.label}
                              </Link>
                            </NavigationMenuPrimitive.Link>
                          </li>
                        ))}
                      </ul>
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
            className="hidden min-h-11 items-center px-2 text-base font-medium text-[var(--pa-color-ink-muted)] hover:text-[var(--pa-color-ink)] lg:inline-flex"
          >
            {zh ? "EN" : "中文"}
          </Link>
          {notificationsEnabled ? (
            <Link
              href={`/${locale}/me/inbox` as Route}
              className="hidden size-11 items-center justify-center rounded-full bg-[var(--pa-color-surface-subtle)] text-[var(--pa-color-ink)] hover:bg-[var(--pa-color-surface-hover)] lg:inline-flex"
              aria-label={zh ? "打开我的通知" : "Open my notifications"}
              title={zh ? "通知" : "Notifications"}
            >
              <Bell className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
          <Link
            href={`/${locale}/me` as Route}
            className="pa-header-cta inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-[var(--pa-color-accent)] px-5 text-base font-semibold text-[var(--pa-color-on-accent)] hover:bg-[var(--pa-color-accent-hover)] max-sm:px-4 max-[25rem]:px-0"
          >
            <Heart className="size-4 shrink-0 fill-[var(--pa-color-highlight)] text-[var(--pa-color-highlight)]" aria-hidden="true" />
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
              <SheetHeader className="border-b-[0.5px] border-[var(--pa-color-line)] px-6 pb-5 pt-7 text-left">
                <SheetTitle className="text-xl font-extrabold text-[var(--pa-color-ink)]">
                  {zh ? "吱熊猫" : "ZhiPanda"}
                </SheetTitle>
              </SheetHeader>

              <nav className="px-5 pt-3" aria-label={zh ? "移动导航" : "Mobile navigation"}>
                {sections.map((section) => (
                  <div key={section.href} className="border-b-[0.5px] border-[var(--pa-color-line)] py-1">
                    <SheetClose asChild>
                      <Link
                        href={section.href as Route}
                        className="grid min-h-14 grid-cols-[1fr_auto] items-center px-1 text-[var(--pa-color-ink)]"
                      >
                        <strong className="text-xl font-extrabold">
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
                              className="inline-flex min-h-9 items-center text-base text-[var(--pa-color-ink-muted)]"
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
                        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--pa-color-surface-subtle)] px-5 text-base font-semibold"
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
                      className="inline-flex min-h-12 items-center text-base text-[var(--pa-color-ink-muted)]"
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
