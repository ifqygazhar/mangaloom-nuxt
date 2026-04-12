export default defineEventHandler(async (event) => {
  const source = getRouterParam(event, "source");
  const id = getRouterParam(event, "id");
  if (!source) throw createError({ statusCode: 400, statusMessage: "Missing source" });
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const href = `/${decodeURIComponent(id)}/`;
  const parser = getParser(source);
  return await parser.fetchDetail(href);
});
