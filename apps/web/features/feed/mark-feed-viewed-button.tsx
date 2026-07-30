"use client";

import { useRef, useState } from "react";
import { Check, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PublicLocale } from "@/foundation/content/locales";

interface MarkFeedViewedButtonProps {
  locale: PublicLocale;
  viewedThroughAt: string;
}

const copy = {
  zh: {
    idle: "将当前动态标记为已读",
    busy: "正在保存…",
    done: "已标记为已读",
    error: "暂时无法保存已读位置，请稍后重试。",
  },
  en: {
    idle: "Mark current Activity viewed",
    busy: "Saving…",
    done: "Marked as viewed",
    error: "The viewed position could not be saved. Try again later.",
  },
} as const;

export function MarkFeedViewedButton({
  locale,
  viewedThroughAt,
}: MarkFeedViewedButtonProps) {
  const t = copy[locale];
  const idempotencyKey = useRef<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function markViewed() {
    setState("busy");
    idempotencyKey.current ??= `feed-view-${crypto.randomUUID()}`;
    const response = await fetch("/api/feed/last-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotency_key: idempotencyKey.current,
        viewed_through_at: viewedThroughAt,
      }),
    }).catch(() => null);
    setState(response?.ok ? "done" : "error");
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-11 rounded-full"
        disabled={state === "busy" || state === "done"}
        onClick={() => void markViewed()}
      >
        {state === "done" ? <Check aria-hidden="true" /> : <Eye aria-hidden="true" />}
        {state === "busy" ? t.busy : state === "done" ? t.done : t.idle}
      </Button>
      {state === "error" ? (
        <p role="alert" className="text-sm text-red-700">{t.error}</p>
      ) : null}
    </div>
  );
}
