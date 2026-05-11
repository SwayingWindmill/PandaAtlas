"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Camera, Heart, Share2 } from "lucide-react";

const STORAGE_KEY = "panda-atlas:saved-profiles";

function readSavedProfiles(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function writeSavedProfiles(values: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Ignore storage failures so the CTA still feels responsive.
  }
}

async function copyLink(url: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  await navigator.clipboard.writeText(url);
  return true;
}

interface ProfileHeroActionsProps {
  slug: string;
  nameZh: string;
}

export function ProfileHeroActions({ slug, nameZh }: ProfileHeroActionsProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const lineageHref = `/lineage?focus=${encodeURIComponent(slug)}`;

  useEffect(() => {
    setIsSaved(readSavedProfiles().includes(slug));
  }, [slug]);

  useEffect(() => {
    if (!feedback || typeof window === "undefined") {
      return;
    }

    const timeout = window.setTimeout(() => setFeedback(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const handleSaveToggle = () => {
    const savedProfiles = new Set(readSavedProfiles());

    if (savedProfiles.has(slug)) {
      savedProfiles.delete(slug);
      setIsSaved(false);
      setFeedback(`已取消收藏 ${nameZh}`);
    } else {
      savedProfiles.add(slug);
      setIsSaved(true);
      setFeedback(`已收藏 ${nameZh}`);
    }

    writeSavedProfiles([...savedProfiles]);
  };

  const handleShare = async () => {
    if (typeof window === "undefined") {
      return;
    }

    const url = window.location.href;
    const title = `${nameZh} | 大熊猫图鉴`;
    const text = `查看 ${nameZh} 的个体档案`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setFeedback(`已打开系统分享：${nameZh}`);
        return;
      }

      const copied = await copyLink(url);
      setFeedback(copied ? `已复制 ${nameZh} 的档案链接` : "当前浏览器不支持系统分享，请手动复制地址栏链接");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setFeedback("已取消分享");
        return;
      }

      try {
        const copied = await copyLink(url);
        setFeedback(copied ? `分享失败，已复制 ${nameZh} 的档案链接` : "分享失败，请稍后重试");
      } catch {
        setFeedback("分享失败，请稍后重试");
      }
    }
  };

  return (
    <div className="flex shrink-0 flex-wrap gap-3 lg:max-w-[20rem] lg:flex-col lg:items-stretch lg:self-end">
      <button
        type="button"
        aria-pressed={isSaved}
        aria-label={`${isSaved ? "取消收藏" : "收藏"} ${nameZh} 档案`}
        onClick={handleSaveToggle}
        className="inline-flex items-center justify-center gap-2 rounded-[1rem] bg-[var(--accent)] px-7 py-4 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(0,0,0,0.12)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.92)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(7,10,8,0.72)]"
      >
        <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
        {isSaved ? "已收藏档案" : "收藏档案"}
      </button>
      <Link
        href={lineageHref as Route}
        data-testid="profile-lineage-link"
        className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-white/22 bg-white/14 px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.92)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(7,10,8,0.72)]"
      >
        <ArrowRight className="h-4 w-4" />
        查看谱系
      </Link>
      <button
        type="button"
        aria-label={`分享 ${nameZh} 档案`}
        onClick={handleShare}
        className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-white/22 bg-white/14 px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.92)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(7,10,8,0.72)]"
      >
        <Share2 className="h-4 w-4" />
        分享档案
      </button>
      <a
        href="#media"
        className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-white/18 bg-transparent px-7 py-4 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.92)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(7,10,8,0.72)]"
      >
        <Camera className="h-4 w-4" />
        查看影像
      </a>
      <p
        aria-live="polite"
        className="basis-full rounded-[0.95rem] border border-white/12 bg-black/16 px-4 py-3 text-xs leading-6 text-white/76 backdrop-blur-sm"
      >
        {feedback ?? "可将当前档案收藏到本机浏览器，或继续前往谱系关系与影像记录。"}
      </p>
    </div>
  );
}
