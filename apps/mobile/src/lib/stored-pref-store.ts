export interface PrefStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface StoredPrefOptions<T> {
  key: string;
  parse: (stored: string | null) => T;
  serialize: (value: T) => string;
  onChange?: (value: T) => void;
}

export interface StoredPrefStore<T> {
  getCurrent(): T | undefined;
  read(): Promise<T>;
  set(next: T): void;
  subscribe(listener: (value: T) => void): () => void;
}

export function createStoredPrefStore<T>(
  storage: PrefStorage,
  options: StoredPrefOptions<T>,
): StoredPrefStore<T> {
  let current: T | undefined;
  let revision = 0;
  let reading: Promise<T> | undefined;
  let pendingWrite = Promise.resolve();
  const listeners = new Set<(value: T) => void>();

  function read(): Promise<T> {
    if (current !== undefined) return Promise.resolve(current);
    if (!reading) {
      const readRevision = revision;
      reading = storage
        .getItem(options.key)
        .catch(() => null)
        .then((stored) => {
          if (revision === readRevision && current === undefined) {
            current = options.parse(stored);
            options.onChange?.(current);
            for (const listener of listeners) listener(current);
          }
          return current as T;
        });
    }
    return reading;
  }

  function set(next: T): void {
    revision += 1;
    current = next;
    for (const listener of listeners) listener(next);
    options.onChange?.(next);
    pendingWrite = pendingWrite
      .then(() => storage.setItem(options.key, options.serialize(next)))
      .catch(() => undefined);
  }

  function subscribe(listener: (value: T) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    getCurrent: () => current,
    read,
    set,
    subscribe,
  };
}
