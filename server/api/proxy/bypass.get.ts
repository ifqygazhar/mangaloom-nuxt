const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/i,
  /^::$/i,
  /^::ffff:/i,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^metadata\.google(?:\.internal)?$/i,
  /^kubernetes\.default$/i,
  /\.internal$/i,
  /\.local$/i,
];

const BLOCKED_PORTS = new Set([
  22, 23, 25, 53, 110, 143, 445, 587, 993, 995, 2379, 2380, 3306, 5432, 6379,
  11211, 27017, 6443, 8200, 8500, 8600, 9200, 9300,
]);

function getSingleQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function assertAllowedUrl(rawUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid url parameter",
    });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Only http and https URLs are allowed",
    });
  }

  if (parsed.username || parsed.password) {
    throw createError({
      statusCode: 400,
      statusMessage: "URL credentials are not allowed",
    });
  }

  if (parsed.port) {
    const port = Number.parseInt(parsed.port, 10);
    if (BLOCKED_PORTS.has(port)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Blocked destination port",
      });
    }
  }

  const hostname = parsed.hostname.toLowerCase();
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Blocked destination host",
    });
  }

  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Blocked destination host",
      });
    }
  }

  return parsed;
}

function normalizeReferer(rawReferer: string): string | undefined {
  if (!rawReferer) {
    return undefined;
  }

  try {
    const parsed = new URL(rawReferer);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return undefined;
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawUrl = getSingleQueryValue(query.url as string | string[] | undefined);

  if (!rawUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing url parameter",
    });
  }

  const targetUrl = assertAllowedUrl(rawUrl);
  const requestUrl = getRequestURL(event);

  if (targetUrl.origin === requestUrl.origin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Proxy loop is not allowed",
    });
  }

  const referer = normalizeReferer(
    getSingleQueryValue(query.referer as string | string[] | undefined),
  );

  const upstreamResponse = await fetch(targetUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": DEFAULT_USER_AGENT,
      ...(referer ? { Referer: referer } : {}),
    },
  });

  const responseHeaders = new Headers();
  const contentType =
    upstreamResponse.headers.get("content-type") ??
    "application/octet-stream";
  const cacheControl =
    upstreamResponse.headers.get("cache-control") ??
    "public, max-age=60, s-maxage=60";

  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Cache-Control", cacheControl);
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  for (const headerName of [
    "content-length",
    "content-language",
    "etag",
    "last-modified",
  ]) {
    const value = upstreamResponse.headers.get(headerName);
    if (value) {
      responseHeaders.set(headerName, value);
    }
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
});
