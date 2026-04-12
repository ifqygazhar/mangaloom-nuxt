export default defineEventHandler(async (event) => {
  const source = getRouterParam(event, "source");
  if (!source) throw createError({ statusCode: 400, statusMessage: "Missing source" });

  const query = getQuery(event);
  const page = parseInt(query.page as string, 10) || 1;

  const parser = getParser(source);
  return await parser.fetchNewest(page);
});
