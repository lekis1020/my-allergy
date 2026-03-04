import { format, formatDistanceToNow, parseISO, subDays } from "date-fns";

export function formatDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "MMM d, yyyy");
}

export function formatRelativeDate(dateString: string): string {
  const date = parseISO(dateString);
  return formatDistanceToNow(date, { addSuffix: true });
}

export function getDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = subDays(to, days);
  return {
    from: format(from, "yyyy/MM/dd"),
    to: format(to, "yyyy/MM/dd"),
  };
}

export function toISODate(dateString: string): string {
  const parts = dateString.split(/[\/\-]/);
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return dateString;
}
