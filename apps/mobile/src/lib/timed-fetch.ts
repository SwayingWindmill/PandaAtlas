/**
 * How long a public read may wait for the API. On a weak network a stalled request otherwise never settles, so the
 * screen stays on its skeleton with no way to retry; after this the saved copy or the screen's retry takes over.
 */
export const REQUEST_TIMEOUT_MS = 20_000;

export function timedFetch(request: Request, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs} ms`)), timeoutMs);
  const cancel = () => controller.abort(request.signal.reason);
  request.signal.addEventListener("abort", cancel, { once: true });
  return fetch(request, { signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
  });
}
