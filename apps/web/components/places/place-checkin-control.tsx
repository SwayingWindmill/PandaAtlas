"use client";

import { MapPinCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { checkinsQueryOptions, fanKeys, fanMutationOptions } from "@/features/fan/api/queries";
import { beginSignIn, useFanSession } from "@/features/fan/api/session";
import { ApiRequestError } from "@/lib/api/request";
import { isEngagementUiEnabled } from "@/lib/engagement/config";

interface PlaceCheckinControlProps {
  placeId: string;
  slug: string;
  name: string;
  locale: "zh" | "en";
}

function localDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function PlaceCheckinControl({ placeId, slug, name, locale }: PlaceCheckinControlProps) {
  const engagementEnabled = isEngagementUiEnabled();
  const queryClient = useQueryClient();
  const session = useFanSession(engagementEnabled);
  const checkins = useQuery({ ...checkinsQueryOptions, enabled: engagementEnabled && session.status === "ready" });
  const [feedback, setFeedback] = useState("");
  const today = localDate();
  const returnPath = `/${locale}/places/${slug}`;
  const zh = locale === "zh";
  const unavailableCopy = zh ? "打卡暂时不可用。" : "Check-ins are temporarily unavailable.";

  const settle = {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: fanKeys.checkins });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 401) {
        beginSignIn(returnPath);
        return;
      }
      setFeedback(unavailableCopy);
    },
  };
  const create = useMutation({
    ...fanMutationOptions.createCheckin(),
    ...settle,
    onSuccess: async () => {
      setFeedback(zh ? `已记录今天来过${name}。` : `Recorded today's visit to ${name}.`);
      await settle.onSuccess();
    },
  });
  const remove = useMutation({
    ...fanMutationOptions.removeCheckin(),
    ...settle,
    onSuccess: async () => {
      setFeedback(zh ? `已删除今天在${name}的打卡。` : `Removed today's check-in at ${name}.`);
      await settle.onSuccess();
    },
  });

  if (!engagementEnabled) return null;

  const current = checkins.data?.find((item) => item.placeId === placeId && item.visitedOn === today);
  const checked = current !== undefined;
  const loading = session.status === "loading" || (session.status === "ready" && checkins.isPending);
  const unavailable = session.status === "blocked" || session.status === "unavailable" || checkins.isError;
  const busy = create.isPending || remove.isPending;
  const message = feedback || (unavailable ? unavailableCopy : "");

  function toggleCheckin() {
    if (session.status === "signed-out") {
      beginSignIn(returnPath);
      return;
    }
    setFeedback("");
    if (current) remove.mutate(current.checkinId);
    else create.mutate({ placeId, visitedOn: today, note: null });
  }

  return (
    <div className="mt-5 flex max-w-md flex-col gap-2">
      <button
        type="button"
        disabled={busy || loading}
        aria-pressed={checked}
        onClick={toggleCheckin}
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
      {message ? <p className="text-sm" role="status">{message}</p> : null}
    </div>
  );
}
