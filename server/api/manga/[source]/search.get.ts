export default defineEventHandler(async (event) => {
  const source = getRouterParam(event, "source");
  if (!source) throw createError({ statusCode: 400, statusMessage: "Missing source" });

  const query = getQuery(event);
  const q = (query.q as string) ?? "";
  if (!q) throw createError({ statusCode: 400, statusMessage: "Missing query parameter 'q'" });

  const parser = getParser(source);
  return await parser.search(q);
});
