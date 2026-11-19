import { describe, expect, it, vi } from "vitest";

import { createStoredPrefStore, type PrefStorage } from "./stored-pref-store";

function memoryStorage(initial: string | null = null): {
  storage: PrefStorage;
  getItem: ReturnType<typeof vi.fn<PrefStorage["getItem"]>>;
  setItem: ReturnType<typeof vi.fn<PrefStorage["setItem"]>>;
} {
  let value = initial;
  const getItem = vi.fn<PrefStorage["getItem"]>(async () => value);
  const setItem = vi.fn<PrefStorage["setItem"]>(async (_key, next) => {
    value = next;
  });
  return { storage: { getItem, setItem }, getItem, setItem };
}

describe("createStoredPrefStore", () => {
  it("parses defaults on initial read and shares in-flight reads", async () => {
    let resolveRead!: (value: string | null) => void;
    const { storage, getItem } = memoryStorage();
    getItem.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => {
        resolveRead = resolve;
      }),
    );
    const onChange = vi.fn();
    const store = createStoredPrefStore(storage, {
      key: "test-pref",
      parse: (stored) => stored === "on",
      serialize: (on) => (on ? "on" : "off"),
      onChange,
    });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    const first = store.read();
    const second = store.read();
    expect(getItem).toHaveBeenCalledTimes(1);

    resolveRead(null);
    expect(await first).toBe(false);
    expect(await second).toBe(false);
    expect(store.getCurrent()).toBe(false);
    expect(listener).toHaveBeenCalledWith(false);
    expect(onChange).toHaveBeenCalledWith(false);

    unsubscribe();
    store.set(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("lets a concurrent set beat a slow read and serializes writes", async () => {
    let finishRead!: (value: string | null) => void;
    let finishFirstWrite!: () => void;
    const { storage, getItem, setItem } = memoryStorage();
    getItem.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => {
        finishRead = resolve;
      }),
    );
    setItem.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishFirstWrite = resolve;
      }),
    );
    const onChange = vi.fn();
    const store = createStoredPrefStore(storage, {
      key: "appearance",
      parse: (stored) => stored ?? "system",
      serialize: (value) => value,
      onChange,
    });

    const pendingRead = store.read();
    store.set("dark");
    store.set("light");
    finishRead("system");

    expect(await pendingRead).toBe("light");
    expect(store.getCurrent()).toBe("light");
    expect(onChange.mock.calls).toEqual([["dark"], ["light"]]);
    expect(setItem).toHaveBeenCalledTimes(1);

    finishFirstWrite();
    await vi.waitFor(() => {
      expect(setItem.mock.calls).toEqual([
        ["appearance", "dark"],
        ["appearance", "light"],
      ]);
    });
  });

  it("swallows storage read and write failures without dropping future updates", async () => {
    const getItem = vi.fn<PrefStorage["getItem"]>().mockRejectedValueOnce(new Error("read failed"));
    const setItem = vi
      .fn<PrefStorage["setItem"]>()
      .mockRejectedValueOnce(new Error("write failed"))
      .mockResolvedValueOnce(undefined);
    const store = createStoredPrefStore(
      { getItem, setItem },
      {
        key: "flag",
        parse: (stored) => stored === "1",
        serialize: (on) => (on ? "1" : "0"),
      },
    );

    expect(await store.read()).toBe(false);
    store.set(true);
    store.set(false);
    await vi.waitFor(() => {
      expect(setItem.mock.calls).toEqual([
        ["flag", "1"],
        ["flag", "0"],
      ]);
    });
  });
});
