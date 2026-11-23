/** True when a load failed and there is nothing to show. A failed background refetch keeps the data on screen. */
export function failedWithoutData(query: { isError: boolean; data: unknown }): boolean {
  return query.isError && query.data === undefined;
}
