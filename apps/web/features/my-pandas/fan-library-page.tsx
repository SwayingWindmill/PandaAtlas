"use client";

import type { Route } from "next";
import Link from "next/link";
import { FolderHeart, Heart, LogIn, Plus, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { MyPandasProfileSummary } from "@/features/my-pandas/my-pandas-view-model";
import type { PublicLocale } from "@/foundation/content/locales";

interface Favorite {
  panda_id: string;
  favorited_at: string;
}

interface FanCollection {
  collection_id: string;
  name: string;
  panda_ids: string[];
  created_at: string;
  updated_at: string;
}

type PageState = "loading" | "ready" | "signed-out" | "error";

const copy = {
  zh: {
    eyebrow: "我的熊猫",
    title: "收藏与合集",
    description: "把喜欢的熊猫留在自己的清单里，再按旅行、家族、最喜欢或任何你自己的方式整理。",
    favorites: "我的收藏",
    favoritesBody: "收藏会同时进入“我的熊猫”、熊猫护照和你的个人动态；提醒仍需你主动开启。",
    noFavorites: "还没有收藏熊猫。先去图鉴里找到你喜欢的熊猫吧。",
    browse: "去发现熊猫",
    collections: "我的合集",
    collectionsBody: "一个熊猫可以放进多个合集。合集只有当前账号可以看到。",
    create: "新建合集",
    createPlaceholder: "例如：成都想见、最喜欢、熊猫宝宝",
    createAction: "创建",
    emptyCollections: "还没有合集。创建第一个合集开始整理收藏。",
    addTo: "加入合集",
    removeFrom: "移出合集",
    deleteCollection: "删除合集",
    rename: "重命名",
    saveName: "保存名称",
    open: "查看熊猫",
    memberCount: (count: number) => `${count} 只熊猫`,
    signIn: "登录后使用跨设备收藏与合集。",
    signInAction: "登录",
    unavailable: "收藏与合集暂时无法读取，请稍后重试。",
    duplicate: "这个合集名称已经存在。",
  },
  en: {
    eyebrow: "My Pandas",
    title: "Favorites & collections",
    description: "Keep the pandas you love in a private list, then organize them by trips, families, favorites, or anything else that matters to you.",
    favorites: "My favorites",
    favoritesBody: "Favorites are private and also power My Pandas, your Panda Passport, and your personal feed. Notifications remain opt-in.",
    noFavorites: "You have not favorited a panda yet. Discover one you love first.",
    browse: "Discover pandas",
    collections: "My collections",
    collectionsBody: "A panda can belong to more than one collection. Collections are private to your account.",
    create: "New collection",
    createPlaceholder: "For example: Chengdu trip, Favorites, Panda cubs",
    createAction: "Create",
    emptyCollections: "No collections yet. Create your first one to organize favorites.",
    addTo: "Add to collection",
    removeFrom: "Remove",
    deleteCollection: "Delete collection",
    rename: "Rename",
    saveName: "Save name",
    open: "Open panda",
    memberCount: (count: number) => `${count} panda${count === 1 ? "" : "s"}`,
    signIn: "Sign in to use synced favorites and collections.",
    signInAction: "Sign in",
    unavailable: "Favorites and collections are temporarily unavailable. Please try again.",
    duplicate: "A collection with this name already exists.",
  },
} as const;

export function FanLibraryPage({
  locale,
  profiles,
}: {
  locale: PublicLocale;
  profiles: MyPandasProfileSummary[];
}) {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [collections, setCollections] = useState<FanCollection[]>([]);
  const [newName, setNewName] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const t = copy[locale];
  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  useEffect(() => {
    let active = true;

    async function loadLibrary() {
      const [favoriteResponse, collectionResponse] = await Promise.all([
        fetch("/api/engagement/favorites", { cache: "no-store" }),
        fetch("/api/engagement/collections", { cache: "no-store" }),
      ]);
      if (!active) return;
      if (favoriteResponse.status === 401 || collectionResponse.status === 401) {
        setPageState("signed-out");
        return;
      }
      if (!favoriteResponse.ok || !collectionResponse.ok) {
        setPageState("error");
        return;
      }
      const favoritePayload = await favoriteResponse.json() as { items?: Favorite[] };
      const collectionPayload = await collectionResponse.json() as { items?: FanCollection[] };
      if (!active) return;
      setFavorites(Array.isArray(favoritePayload.items) ? favoritePayload.items : []);
      setCollections(Array.isArray(collectionPayload.items) ? collectionPayload.items : []);
      setPageState("ready");
    }

    void loadLibrary();
    return () => {
      active = false;
    };
  }, []);

  async function createCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusyKey("create");
    setFeedback("");
    const response = await fetch("/api/engagement/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusyKey(null);
    if (response.status === 409) {
      setFeedback(t.duplicate);
      return;
    }
    if (!response.ok) {
      setFeedback(t.unavailable);
      return;
    }
    const created = await response.json() as FanCollection;
    setCollections((current) => [created, ...current]);
    setNewName("");
  }

  async function renameCollection(collection: FanCollection, name: string) {
    const normalized = name.trim();
    if (!normalized || normalized === collection.name) return;
    setBusyKey(`rename-${collection.collection_id}`);
    setFeedback("");
    const response = await fetch(`/api/engagement/collections/${collection.collection_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalized }),
    });
    setBusyKey(null);
    if (response.status === 409) {
      setFeedback(t.duplicate);
      return;
    }
    if (!response.ok) {
      setFeedback(t.unavailable);
      return;
    }
    const updated = await response.json() as FanCollection;
    setCollections((current) => current.map((item) => (
      item.collection_id === updated.collection_id ? updated : item
    )));
  }

  async function deleteCollection(collectionId: string) {
    setBusyKey(`delete-${collectionId}`);
    setFeedback("");
    const response = await fetch(`/api/engagement/collections/${collectionId}`, {
      method: "DELETE",
    });
    setBusyKey(null);
    if (!response.ok) {
      setFeedback(t.unavailable);
      return;
    }
    setCollections((current) => current.filter((item) => item.collection_id !== collectionId));
  }

  async function setMembership(collection: FanCollection, pandaId: string, member: boolean) {
    const key = `${collection.collection_id}-${pandaId}`;
    setBusyKey(key);
    setFeedback("");
    const response = await fetch(
      `/api/engagement/collections/${collection.collection_id}/pandas/${encodeURIComponent(pandaId)}`,
      { method: member ? "POST" : "DELETE" },
    );
    setBusyKey(null);
    if (!response.ok) {
      setFeedback(t.unavailable);
      return;
    }
    const updated = await response.json() as FanCollection;
    setCollections((current) => current.map((item) => (
      item.collection_id === updated.collection_id ? updated : item
    )));
  }

  if (pageState === "loading") {
    return <p className="py-12 text-sm text-[var(--muted)]" role="status">{locale === "zh" ? "正在读取你的收藏……" : "Loading your favorites…"}</p>;
  }

  if (pageState === "signed-out") {
    return (
      <section className="my-10 rounded-2xl border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] p-6 sm:p-8">
        <LogIn aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold">{t.signIn}</p>
        <Link className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white" href={`/auth/login?next=/${locale}/me/collections` as Route}>
          {t.signInAction}
        </Link>
      </section>
    );
  }

  if (pageState === "error") {
    return <p className="my-10 rounded-xl border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] p-5" role="alert">{t.unavailable}</p>;
  }

  return (
    <div className="grid gap-12 py-10">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-[var(--accent)]">{t.eyebrow}</p>
        <h1 className="mt-3 text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>{t.title}</h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">{t.description}</p>
      </header>

      {feedback ? <p className="rounded-xl border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] p-4" role="status">{feedback}</p> : null}

      <section aria-labelledby="favorites-title">
        <div className="flex items-start gap-3">
          <Heart className="mt-1 h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          <div>
            <h2 id="favorites-title" className="text-2xl font-semibold">{t.favorites}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t.favoritesBody}</p>
          </div>
        </div>
        {favorites.length ? (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {favorites.map((favorite) => {
              const profile = profilesById.get(favorite.panda_id);
              return (
                <li key={favorite.panda_id} className="rounded-2xl border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-5">
                  <h3 className="text-xl font-semibold">{profile?.name ?? favorite.panda_id}</h3>
                  {profile ? <p className="mt-1 text-sm text-[var(--muted)]">{profile.currentPlace}</p> : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {profile ? <Link className="rounded-lg border border-[var(--pa-color-accent-border-12)] px-3 py-2 text-sm font-semibold" href={profile.href as Route}>{t.open}</Link> : null}
                    {collections.map((collection) => {
                      const member = collection.panda_ids.includes(favorite.panda_id);
                      return (
                        <button
                          key={collection.collection_id}
                          type="button"
                          disabled={busyKey === `${collection.collection_id}-${favorite.panda_id}`}
                          onClick={() => void setMembership(collection, favorite.panda_id, !member)}
                          className="rounded-lg border border-[var(--pa-color-accent-border-12)] px-3 py-2 text-sm font-semibold disabled:opacity-60"
                        >
                          {member ? `${t.removeFrom} · ${collection.name}` : `${t.addTo} · ${collection.name}`}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--pa-color-accent-border-22)] p-6">
            <p>{t.noFavorites}</p>
            <Link className="mt-4 inline-flex font-semibold text-[var(--accent)] underline underline-offset-4" href={`/${locale}/pandas` as Route}>{t.browse}</Link>
          </div>
        )}
      </section>

      <section aria-labelledby="collections-title">
        <div className="flex items-start gap-3">
          <FolderHeart className="mt-1 h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          <div>
            <h2 id="collections-title" className="text-2xl font-semibold">{t.collections}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t.collectionsBody}</p>
          </div>
        </div>

        <form className="mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row" onSubmit={createCollection}>
          <label className="sr-only" htmlFor="new-collection-name">{t.create}</label>
          <input
            id="new-collection-name"
            value={newName}
            maxLength={80}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t.createPlaceholder}
            className="min-h-12 flex-1 rounded-xl border border-[var(--pa-color-accent-border-14)] bg-[var(--card)] px-4 py-3"
          />
          <button type="submit" disabled={!newName.trim() || busyKey === "create"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-60">
            <Plus className="h-4 w-4" aria-hidden="true" />{t.createAction}
          </button>
        </form>

        {collections.length ? (
          <ul className="mt-6 grid gap-5">
            {collections.map((collection) => (
              <li key={collection.collection_id} className="rounded-2xl border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-5 sm:p-6">
                <CollectionHeading
                  key={collection.updated_at}
                  collection={collection}
                  locale={locale}
                  busy={busyKey === `rename-${collection.collection_id}`}
                  onRename={(name) => void renameCollection(collection, name)}
                />
                <p className="mt-2 text-sm text-[var(--muted)]">{t.memberCount(collection.panda_ids.length)}</p>
                {collection.panda_ids.length ? (
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {collection.panda_ids.map((pandaId) => {
                      const profile = profilesById.get(pandaId);
                      return (
                        <li key={pandaId} className="rounded-full border border-[var(--pa-color-accent-border-12)] px-3 py-2 text-sm">
                          {profile?.name ?? pandaId}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <button
                  type="button"
                  disabled={busyKey === `delete-${collection.collection_id}`}
                  onClick={() => void deleteCollection(collection.collection_id)}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--pa-color-accent-border-12)] px-3 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />{t.deleteCollection}
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-6 rounded-2xl border border-dashed border-[var(--pa-color-accent-border-22)] p-6">{t.emptyCollections}</p>}
      </section>
    </div>
  );
}

function CollectionHeading({
  collection,
  locale,
  busy,
  onRename,
}: {
  collection: FanCollection;
  locale: PublicLocale;
  busy: boolean;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(collection.name);
  const t = copy[locale];

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold">{collection.name}</h3>
        <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold underline underline-offset-4" onClick={() => setEditing(true)}>{t.rename}</button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onRename(name);
        setEditing(false);
      }}
    >
      <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="min-h-11 flex-1 rounded-lg border border-[var(--pa-color-accent-border-14)] px-3 py-2" aria-label={t.rename} />
      <button type="submit" disabled={busy || !name.trim()} className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{t.saveName}</button>
    </form>
  );
}
