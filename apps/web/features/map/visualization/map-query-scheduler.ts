export interface MapQueryScheduler {
  schedule(task: () => void): void;
  cancel(): void;
  samples(): number[];
}

export function createMapQueryScheduler(delayMs = 220): MapQueryScheduler {
  let timeoutId: number | null = null;
  const durations: number[] = [];

  return {
    schedule(task) {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      const startedAt = performance.now();
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        durations.push(performance.now() - startedAt);
        if (durations.length > 40) durations.shift();
        task();
      }, delayMs);
    },
    cancel() {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = null;
    },
    samples() {
      return [...durations];
    },
  };
}

export function percentile95(samples: number[]): number | null {
  if (!samples.length) return null;
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)];
}
