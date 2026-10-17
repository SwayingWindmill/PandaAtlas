"use client";

import type { Route } from "next";
import Link from "next/link";
import { Eye, LogIn, MapPinCheck, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { checkinsQueryOptions, fanMutationOptions, seenPandasQueryOptions } from "@/features/fan/api/queries";
import { privateReadStatus, signInHref, useFanSession } from "@/features/fan/api/session";
import type { PublicLocale } from "@/foundation/content/locales";

interface NamedReference {
  id: string;
  name: string;
  href: string;
}

const copy = {
  zh: {
    eyebrow: "我的熊猫",
    title: "足迹与见过",
    description: "回看你去过的熊猫地点，以及亲眼见过的熊猫。两类记录彼此独立，只属于你的账号。",
    checkins: "去过的地点",
    checkinsBody: "地点打卡只说明你去过那里，不代表当时见到了任何熊猫。",
    seen: "我见过的熊猫",
    seenBody: "见过熊猫是你的私人见面记录；地点和日期可以留空。",
    emptyCheckins: "还没有地点打卡。打开一个熊猫地点页面即可记录。",
    emptySeen: "还没有“见过熊猫”记录。打开熊猫资料页即可添加。",
    browsePlaces: "去地图找地点",
    browsePandas: "去发现熊猫",
    remove: "删除记录",
    signIn: "登录后查看跨设备同步的私人足迹。",
    signInAction: "登录",
    unavailable: "足迹与见过记录暂时无法读取。",
    unknownPlace: "当前公开资料中没有这个地点",
    unknownPanda: "当前公开资料中没有这只熊猫",
    seenAt: "见到地点",
    dateUnknown: "日期未记录",
  },
  en: {
    eyebrow: "My Pandas",
    title: "Visits & pandas I've seen",
    description: "Look back at panda places you've visited and pandas you've seen in person. The two records stay separate and private to your account.",
    checkins: "Places I've visited",
    checkinsBody: "A place check-in records only that you visited. It never means you saw a panda there.",
    seen: "Pandas I've seen",
    seenBody: "Seen-panda records are private memories. Place and date are optional.",
    emptyCheckins: "No place check-ins yet. Open a panda place page to record one.",
    emptySeen: "No seen-panda records yet. Open a panda profile to add one.",
    browsePlaces: "Explore the map",
    browsePandas: "Discover pandas",
    remove: "Remove record",
    signIn: "Sign in to view your synced private memories.",
    signInAction: "Sign in",
    unavailable: "Your private panda memories are temporarily unavailable.",
    unknownPlace: "This place is not in the current public information",
    unknownPanda: "This panda is not in the current public information",
    seenAt: "Seen at",
    dateUnknown: "Date not recorded",
  },
} as const;

export function FanMemoriesPage({
  locale,
  pandas,
  places,
}: {
  locale: PublicLocale;
  pandas: NamedReference[];
  places: NamedReference[];
}) {
  const session = useFanSession();
  const checkins = useQuery({ ...checkinsQueryOptions, enabled: session.status === "ready" });
  const seenPandas = useQuery({ ...seenPandasQueryOptions, enabled: session.status === "ready" });
  const status = privateReadStatus(session.status, checkins, seenPandas);
  const t = copy[locale];
  const pandaById = useMemo(() => new Map(pandas.map((item) => [item.id, item])), [pandas]);
  const placeById = useMemo(() => new Map(places.map((item) => [item.id, item])), [places]);

  const removeCheckin = useMutation(fanMutationOptions.removeCheckin());
  const removeSeenPanda = useMutation(fanMutationOptions.removeSeenPanda());

  if (status === "loading") {
    return <p className="py-12 text-sm text-[var(--muted)]" role="status">{locale === "zh" ? "正在读取你的私人足迹……" : "Loading your private memories…"}</p>;
  }

  if (status === "signed-out") {
    return (
      <section className="my-10 rounded-2xl border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] p-6 sm:p-8">
        <LogIn aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold">{t.signIn}</p>
        <Link className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white" href={signInHref(`/${locale}/me/memories`) as Route}>
          {t.signInAction}
        </Link>
      </section>
    );
  }

  if (status !== "ready" || checkins.data === undefined || seenPandas.data === undefined) {
    return <p className="my-10 rounded-xl border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] p-5" role="alert">{t.unavailable}</p>;
  }

  return (
    <div className="grid gap-12 py-10">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-[var(--accent)]">{t.eyebrow}</p>
        <h1 className="mt-3 text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>{t.title}</h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">{t.description}</p>
      </header>

      <MemorySection icon={<MapPinCheck aria-hidden="true" />} title={t.checkins} body={t.checkinsBody}>
        {checkins.data.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {checkins.data.map((checkin) => {
              const place = placeById.get(checkin.placeId);
              return (
                <li key={checkin.checkinId} className="rounded-2xl border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-5">
                  <h3 className="text-lg font-semibold">{place?.name ?? t.unknownPlace}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{checkin.visitedOn}</p>
                  {checkin.note ? <p className="mt-3 text-sm leading-6">{checkin.note}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {place ? <Link href={place.href as Route} className="rounded-lg border px-3 py-2 text-sm font-semibold">{place.name}</Link> : null}
                    <button type="button" disabled={removeCheckin.isPending && removeCheckin.variables === checkin.checkinId} onClick={() => removeCheckin.mutate(checkin.checkinId)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60"><Trash2 className="h-4 w-4" aria-hidden="true" />{t.remove}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState text={t.emptyCheckins} href={`/${locale}/map`} action={t.browsePlaces} />}
      </MemorySection>

      <MemorySection icon={<Eye aria-hidden="true" />} title={t.seen} body={t.seenBody}>
        {seenPandas.data.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {seenPandas.data.map((record) => {
              const panda = pandaById.get(record.pandaId);
              const place = record.placeId ? placeById.get(record.placeId) : null;
              return (
                <li key={record.seenId} className="rounded-2xl border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-5">
                  <h3 className="text-lg font-semibold">{panda?.name ?? t.unknownPanda}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{record.seenOn ?? t.dateUnknown}</p>
                  {place ? <p className="mt-1 text-sm text-[var(--muted)]">{t.seenAt}: {place.name}</p> : null}
                  {record.note ? <p className="mt-3 text-sm leading-6">{record.note}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {panda ? <Link href={panda.href as Route} className="rounded-lg border px-3 py-2 text-sm font-semibold">{panda.name}</Link> : null}
                    <button type="button" disabled={removeSeenPanda.isPending && removeSeenPanda.variables === record.pandaId} onClick={() => removeSeenPanda.mutate(record.pandaId)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60"><Trash2 className="h-4 w-4" aria-hidden="true" />{t.remove}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState text={t.emptySeen} href={`/${locale}/pandas`} action={t.browsePandas} />}
      </MemorySection>
    </div>
  );
}

function MemorySection({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-start gap-3">
        <span className="mt-1 text-[var(--accent)]">{icon}</span>
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function EmptyState({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--pa-color-accent-border-22)] p-6">
      <p>{text}</p>
      <Link className="mt-4 inline-flex font-semibold text-[var(--accent)] underline underline-offset-4" href={href as Route}>{action}</Link>
    </div>
  );
}
