export default defineEventHandler(async (event) => {
  const source = getRouterParam(event, "source");
  if (!source) throw createError({ statusCode: 400, statusMessage: "Missing source" });

  const parser = getParser(source);
  return await parser.fetchGenres();
});
