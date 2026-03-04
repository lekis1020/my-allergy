export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

export function formatAuthors(
  authors: { last_name: string; initials: string | null }[],
  maxShow: number = 3
): string {
  if (authors.length === 0) return "";
  const shown = authors.slice(0, maxShow);
  const names = shown.map((a) => `${a.last_name} ${a.initials || ""}`.trim());
  if (authors.length > maxShow) {
    return names.join(", ") + `, +${authors.length - maxShow} more`;
  }
  return names.join(", ");
}

export function formatCitationCount(count: number | null): string {
  if (count === null || count === undefined) return "";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}
