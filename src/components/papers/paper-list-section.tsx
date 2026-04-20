import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { formatCitationCount } from "@/lib/utils/text";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";

export interface LinkedPaper {
  pmid: string;
  title: string;
  publication_date: string;
  epub_date: string | null;
  citation_count: number | null;
  journal_abbreviation: string;
  journal_color: string;
}

interface PaperListSectionProps {
  title: string;
  description?: string;
  papers: LinkedPaper[];
  variant?: "full" | "compact";
  maxItems?: number;
  emptyMessage?: string;
  bookmarkedPmids?: Set<string>;
}

function resolveDate(epub: string | null, pub: string): string {
  return epub || pub || "1970-01-01";
}

export function PaperListSection({
  title,
  description,
  papers,
  variant = "full",
  maxItems,
  emptyMessage = "No linked papers found in the current database window.",
  bookmarkedPmids,
}: PaperListSectionProps) {
  const compact = variant === "compact";
  const limited = maxItems ? papers.slice(0, maxItems) : papers;
  const hiddenCount = papers.length - limited.length;

  return (
    <section>
      <h2
        className={
          compact
            ? "text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
            : "text-sm font-semibold text-gray-900 dark:text-gray-100"
        }
      >
        {title}
      </h2>
      {description && !compact && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}

      {limited.length === 0 ? (
        <p
          className={
            compact
              ? "mt-2 text-xs text-gray-400 dark:text-gray-500"
              : "mt-3 text-sm text-gray-500 dark:text-gray-400"
          }
        >
          {emptyMessage}
        </p>
      ) : (
        <div className={compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2"}>
          {limited.map((paper) => (
            <Link
              key={paper.pmid}
              href={`/paper/${paper.pmid}`}
              className={
                compact
                  ? "block rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/60"
                  : "block rounded-xl border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
              }
            >
              <div className={compact ? "mb-0.5 flex items-center gap-1.5" : "mb-1 flex items-center gap-2"}>
                {bookmarkedPmids?.has(paper.pmid) && (
                  <span className="text-[10px] text-amber-500" title="북마크됨">★</span>
                )}
                <Badge color={paper.journal_color}>{paper.journal_abbreviation}</Badge>
                {!compact && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(resolveDate(paper.epub_date, paper.publication_date))}
                  </span>
                )}
                {!compact && paper.citation_count !== null && paper.citation_count > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    · {formatCitationCount(paper.citation_count)} citations
                  </span>
                )}
              </div>
              <p
                className={
                  compact
                    ? "line-clamp-2 text-xs text-gray-700 dark:text-gray-300"
                    : "line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100"
                }
              >
                {decodeHtmlEntities(paper.title)}
              </p>
            </Link>
          ))}
        </div>
      )}

      {compact && hiddenCount > 0 && (
        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          +{hiddenCount} more
        </p>
      )}
    </section>
  );
}
