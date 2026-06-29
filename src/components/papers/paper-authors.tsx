import type { AuthorSummary } from "@/types/filters";

interface PaperAuthorsProps {
  authors: AuthorSummary[];
  // Total author count when `authors` is a capped subset (feed cards fetch only
  // the first few). Falls back to the array length for full author lists.
  total?: number;
  maxShow?: number;
  className?: string;
}

export function PaperAuthors({ authors, total, maxShow = 3, className }: PaperAuthorsProps) {
  if (authors.length === 0) return null;

  const sorted = [...authors].sort((a, b) => a.position - b.position);
  const shown = sorted.slice(0, maxShow);
  const remaining = (total ?? authors.length) - maxShow;

  return (
    <span className={className ?? "text-sm text-gray-500 dark:text-gray-400"}>
      {shown.map((author, i) => (
        <span key={i}>
          {i > 0 && ", "}
          <span className="text-gray-700 dark:text-gray-300">
            {author.last_name}
          </span>
          {author.initials && (
            <span className="text-gray-500 dark:text-gray-400">
              {" "}
              {author.initials}
            </span>
          )}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-gray-400 dark:text-gray-500">
          {" "}
          +{remaining} more
        </span>
      )}
    </span>
  );
}
