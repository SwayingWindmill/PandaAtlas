import { notifyManager, QueryClient } from "@tanstack/react-query";

// Query Core gives every finished fetch its own setTimeout to tell React. Covers come back fifty to a
// response, so a list of thumbnails got fifty tasks, each a separate sync commit of one row. Each commit
// leaves expo-image's mount effects pending, and React 19 counts a commit that leaves work pending as a
// nested update: past fifty in a row it throws "Maximum update depth exceeded" (a month of birthdays in
// the calendar did). Notifications scheduled in the same tick share one task, so they commit together.
let scheduled: (() => void)[] = [];
notifyManager.setScheduler((callback) => {
  scheduled.push(callback);
  if (scheduled.length > 1) return;
  setTimeout(() => {
    const run = scheduled;
    scheduled = [];
    for (const notify of run) {
      try {
        notify();
      } catch (error) {
        // One listener's failure leaves the rest to run, and still reaches the error overlay.
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }, 0);
});

// Public queries keep the existing network-first offline fallback available.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});
