export default defineEventHandler(async (event) => {
  const source = getRouterParam(event, "source");
  if (!source) throw createError({ statusCode: 400, statusMessage: "Missing source" });

  const query = getQuery(event);
  const page = parseInt(query.page as string, 10) || 1;
  const order = (query.order as string) ?? "";
  const status = (query.status as string) ?? "";
  const type = (query.type as string) ?? "";

  const parser = getParser(source);

  if (order || status || type) {
    return await parser.fetchFiltered({
      page,
      order,
      status,
      type,
    });
  }

  return await parser.fetchNewest(page);
});
