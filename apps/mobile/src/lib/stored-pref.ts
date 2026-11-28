import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { type StoredPrefOptions, createStoredPrefStore } from "./stored-pref-store";

export function createStoredPref<T>(options: StoredPrefOptions<T>) {
  const store = createStoredPrefStore(AsyncStorage, options);

  function useValue(): T | null {
    const [value, setValue] = useState<T | null>(store.getCurrent() ?? null);
    useEffect(() => {
      const unsubscribe = store.subscribe(setValue);
      const existing = store.getCurrent();
      if (existing !== undefined) {
        setValue(existing);
      } else {
        void store.read();
      }
      return unsubscribe;
    }, []);
    return value;
  }

  return {
    read: store.read,
    set: store.set,
    useValue,
  };
}
