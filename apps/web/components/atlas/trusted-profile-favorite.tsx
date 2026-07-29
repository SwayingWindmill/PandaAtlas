"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

import { isEngagementUiEnabled } from "@/lib/engagement/config";

interface TrustedProfileFavoriteProps {
  stableId: string;
  slug: string;
  name: string;
  locale: "zh" | "en";
}

type FollowUiState = "loading" | "signed-out" | "not-following" | "following" | "error";

export function TrustedProfileFavorite({ stableId, slug, name, locale }: TrustedProfileFavoriteProps) {
  const engagementEnabled = isEngagementUiEnabled();
  const [state, setState] = useState<FollowUiState>("loading");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const returnPath = `/${locale}/atlas/${slug}`;

  useEffect(() => {
    if (!engagementEnabled) return;
    let cancelled = false;
    async function loadState() {
      const session = await fetch("/api/identity/session", { cache: "no-store" });
      if (cancelled) return;
      if (session.status === 401) {
        setState("signed-out");
        return;
      }
      if (!session.ok) {
        setState("error");
        return;
      }
      const follow = await fetch(`/api/engagement/follows/${encodeURIComponent(stableId)}`, {
        cache: "no-store",
      });
      if (cancelled) return;
      if (follow.ok) {
        const value = await follow.json() as { state?: string };
        setState(value.state === "active" ? "following" : "not-following");
      } else if (follow.status === 404) {
        setState("not-following");
      } else {
        setState("error");
      }
    }
    void loadState();
    return () => {
      cancelled = true;
    };
  }, [engagementEnabled, stableId]);

  async function startFollow() {
    setBusy(true);
    setFeedback("");
    if (state === "signed-out") {
      const response = await fetch("/api/engagement/follow-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panda_id: stableId, locale, return_path: returnPath }),
      });
      if (!response.ok) {
        setBusy(false);
        setState("error");
        setFeedback(locale === "zh" ? "关注暂时不可用。" : "Follow is temporarily unavailable.");
        return;
      }
      window.location.assign(`/auth/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }

    const response = await fetch(`/api/engagement/follows/${encodeURIComponent(stableId)}`, {
      method: "POST",
    });
    setBusy(false);
    if (!response.ok) {
      setState("error");
      setFeedback(locale === "zh" ? "关注暂时不可用。" : "Follow is temporarily unavailable.");
      return;
    }
    setState("following");
    setFeedback(
      locale === "zh"
        ? `已关注${name}。今后重要动态会出现在你的关注动态和护照中。`
        : `You now follow ${name}. Important updates will appear in your feed and Passport.`,
    );
  }

  async function stopFollow() {
    setBusy(true);
    const response = await fetch(`/api/engagement/follows/${encodeURIComponent(stableId)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!response.ok) {
      setFeedback(locale === "zh" ? "暂时无法取消关注。" : "Unable to unfollow right now.");
      return;
    }
    setState("not-following");
    setFeedback(locale === "zh" ? `已取消关注${name}。` : `You no longer follow ${name}.`);
  }

  if (!engagementEnabled) return null;

  const following = state === "following";
  const label = locale === "zh"
    ? (following ? `取消关注${name}` : `关注${name}`)
    : (following ? `Unfollow ${name}` : `Follow ${name}`);

  return (
    <div className="flex max-w-sm flex-col gap-2">
      <button
        type="button"
        disabled={busy || state === "loading" || state === "error"}
        aria-busy={busy || state === "loading"}
        aria-pressed={following}
        aria-label={label}
        onClick={() => void (following ? stopFollow() : startFollow())}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-px disabled:cursor-wait disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      >
        <Heart className={`h-4 w-4 ${following ? "fill-current" : ""}`} aria-hidden="true" />
        {locale === "zh"
          ? (following ? "已关注" : `关注${name}`)
          : (following ? "Following" : `Follow ${name}`)}
      </button>
      <p className="text-xs leading-5 text-[var(--muted)]">
        {locale === "zh"
          ? "关注会同步到你的账号，并用于关注动态和护照。不会自动开启邮件。"
          : "Following syncs to your account for your feed and Passport. It never enables email automatically."}
      </p>
      <p className="sr-only" aria-live="polite">{feedback}</p>
    </div>
  );
}
