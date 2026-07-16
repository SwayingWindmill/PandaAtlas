export function pathHasValidPercentEncoding(requestOrUrl) {
  const rawUrl = typeof requestOrUrl === "string"
    ? requestOrUrl
    : requestOrUrl.url;
  const { pathname } = new URL(rawUrl);

  try {
    decodeURI(pathname);
    return true;
  } catch {
    return false;
  }
}

export function malformedPathResponse(request) {
  if (pathHasValidPercentEncoding(request)) return null;

  return new Response("Bad Request", {
    status: 400,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
