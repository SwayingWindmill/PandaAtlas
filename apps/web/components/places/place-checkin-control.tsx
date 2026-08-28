"use client";

import { MapPinCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { isEngagementUiEnabled } from "@/lib/engagement/config";

interface PlaceCheckinControlProps {
  placeId: string;
  slug: string;
  name: string;
  locale: "zh" | "en";
}

interface CheckinRecord {
  checkinId: string;
  placeId: string;
  visitedOn: string;
}

type CheckinState = "loading" | "signed-out" | "not-checked" | "checked";

function localDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function PlaceCheckinControl({ placeId, slug, name, locale }: PlaceCheckinControlProps) {
  const engagementEnabled = isEngagementUiEnabled();
  const [state, setState] = useState<CheckinState>("loading");
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const today = localDate();
  const returnPath = `/${locale}/places/${slug}`;
  const zh = locale === "zh";

  useEffect(() => {
    if (!engagementEnabled) return;
    let active = true;

    async function loadState() {
      const response = await fetch("/api/engagement/checkins", { cache: "no-store" });
      if (!active) return;
      if (response.status === 401) {
        setState("signed-out");
        return;
      }
      if (!response.ok) {
        setState("not-checked");
        setFeedback(zh ? "打卡暂时不可用。" : "Check-ins are temporarily unavailable.");
        return;
      }
      const payload = await response.json() as { items?: CheckinRecord[] };
      const current = payload.items?.find(
        (item) => item.placeId === placeId && item.visitedOn === today,
      );
      if (current) {
        setCheckinId(current.checkinId);
        setState("checked");
      } else {
        setState("not-checked");
      }
    }

    void loadState();
    return () => {
      active = false;
    };
  }, [engagementEnabled, placeId, today, zh]);

  async function toggleCheckin() {
    if (state === "signed-out") {
      window.location.assign(`/auth/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    setBusy(true);
    setFeedback("");
    const removing = state === "checked" && checkinId;
    const response = removing
      ? await fetch(`/api/engagement/checkins/${encodeURIComponent(checkinId)}`, { method: "DELETE" })
      : await fetch("/api/engagement/checkins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId, visitedOn: today, note: null }),
        });
    setBusy(false);
    if (response.status === 401) {
      setState("signed-out");
      window.location.assign(`/auth/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (!response.ok) {
      setFeedback(zh ? "打卡暂时不可用。" : "Check-ins are temporarily unavailable.");
      return;
    }
    if (removing) {
      setCheckinId(null);
      setState("not-checked");
      setFeedback(zh ? `已删除今天在${name}的打卡。` : `Removed today's check-in at ${name}.`);
      return;
    }
    const created = await response.json() as CheckinRecord;
    setCheckinId(created.checkinId);
    setState("checked");
    setFeedback(zh ? `已记录今天来过${name}。` : `Recorded today's visit to ${name}.`);
  }

  if (!engagementEnabled) return null;
  const checked = state === "checked";

  return (
    <div className="mt-5 flex max-w-md flex-col gap-2">
      <button
        type="button"
        disabled={busy || state === "loading"}
        aria-pressed={checked}
        onClick={() => void toggleCheckin()}
        className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-60"
      >
        <MapPinCheck className="h-4 w-4" aria-hidden="true" />
        {checked
          ? (zh ? "今天来过" : "Visited today")
          : (zh ? "今天来这里打卡" : "Check in here today")}
      </button>
      <p className="text-sm leading-6 text-[var(--muted)]">
        {zh ? "打卡只记录你来过这个地点，不代表你见到了任何熊猫。" : "A check-in records a place visit only; it never means you saw a panda."}
      </p>
      {feedback ? <p className="text-sm" role="status">{feedback}</p> : null}
    </div>
  );
}
