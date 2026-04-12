export const getMaxValue = (text?: string): string => {
  if (!text) return "";

  const matches = text.match(/\d[\d.,]*\s*(?:jt|rb|k|m|juta|ribu)?/gi) ?? [];
  if (matches.length === 0) return "";

  const parseValue = (str: string) => {
    const normalized = str.replace(/\s+/g, "").toLowerCase();
    const num = parseFloat(normalized.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
    if (normalized.includes("jt") || normalized.includes("juta")) return num * 1000000;
    if (normalized.includes("rb") || normalized.includes("ribu") || normalized.includes("k")) return num * 1000;
    if (normalized.includes("m")) return num * 1000000;
    return num;
  };

  return matches
    .map((value) => value.replace(/\s+/g, ""))
    .reduce((max, current) =>
      parseValue(current) > parseValue(max) ? current : max,
    );
};
