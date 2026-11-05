import { useQuery } from "@tanstack/react-query";

import { localToday } from "@/features/engagement/seen";
import { loadPandaIndex } from "@/features/pandas/pandas";

import { birthdayWeek } from "./birthday-week";

/** This week's birthdays from the cached panda index; recomputed when the day changes. */
export function useBirthdayWeek() {
  const today = localToday();
  return useQuery({
    queryKey: ["birthday-week", today],
    queryFn: async () => birthdayWeek(await loadPandaIndex(), today),
  });
}
