const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

const ENTITY_PATTERN = /&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g;

export function decodeHtmlEntities(value: string): string {
  if (!value || !value.includes("&")) return value;

  return value.replace(ENTITY_PATTERN, (full, entity) => {
    if (entity.startsWith("#")) {
      const isHex = entity[1]?.toLowerCase() === "x";
      const numericPart = isHex ? entity.slice(2) : entity.slice(1);
      const codePoint = Number.parseInt(numericPart, isHex ? 16 : 10);

      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
        return full;
      }

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return full;
      }
    }

    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named ?? full;
  });
}
