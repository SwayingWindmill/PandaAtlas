// How an over-the-air update reaches a fan. An ordinary update downloads in the background and runs from the next
// cold start, so nothing changes under someone mid-screen. An emergency fix raises `extra.otaCriticalIndex` in
// app.json before `eas update`; a running app that sees a higher mark reloads into it at once.

export type UpdateAction = "next-launch" | "reload-now";

/** The emergency mark in an app config's `extra`; anything but a whole number ≥ 0 counts as 0. */
export function criticalIndex(extra: Record<string, unknown> | undefined): number {
  const value = extra?.otaCriticalIndex;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function updateAction(running: number, incoming: number): UpdateAction {
  return incoming > running ? "reload-now" : "next-launch";
}
