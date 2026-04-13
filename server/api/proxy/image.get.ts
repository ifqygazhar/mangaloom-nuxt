export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = query.url as string;
  const source = query.source as string | undefined;

  if (!url) {
    throw createError({ statusCode: 400, statusMessage: "Missing url parameter" });
  }

  // Determine referer based on the image URL or source parameter
  let referer = "";
  if (source === "manhwatop" || url.includes("manhwatop")) {
    referer = "https://manhwatop.com/";
  } else if (url.includes("webtoons.com") || url.includes("webtoon.com")) {
    referer = "https://www.webtoons.com/id/";
  } else if (url.includes("komiku.org") || url.includes("komiku.co.id")) {
    referer = "https://komiku.org";
  }

  try {
    const response = await $fetch.raw(url, {
      responseType: "arrayBuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...(referer ? { Referer: referer } : {}),
      },
    });

    const contentType =
      (response.headers.get("content-type") as string) || "image/jpeg";

    setResponseHeaders(event, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    });

    return response._data;
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to proxy image: ${e.message}`,
    });
  }
});
