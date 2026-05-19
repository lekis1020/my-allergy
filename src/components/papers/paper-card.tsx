import { memo, useMemo, useState } from "react";
import Link from "next/link";
import { PaperAuthors } from "./paper-authors";
import { PaperAbstract } from "./paper-abstract";
import { formatRelativeDate } from "@/lib/utils/date";
import { formatCitationCount } from "@/lib/utils/text";
import { TOPIC_META } from "@/lib/utils/topic-tags";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import type { PaperWithJournal } from "@/types/filters";
import { Bookmark, MessageCircle, Network, Quote, Sparkles, ThumbsUp, Users } from "lucide-react";

interface PaperCardProps {
  paper: PaperWithJournal;
}

function PaperCardComponent({ paper }: PaperCardProps) {
  const [isAbstractOpen, setIsAbstractOpen] = useState(false);

  const avatarLabel = useMemo(
    () =>
      paper.journal_abbreviation
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
    [paper.journal_abbreviation],
  );
  const hasAbstract = Boolean(paper.abstract && paper.abstract.trim().length > 0);

  return (
    <article
      className="relative px-4 py-4 transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-900/70"
    >
      <div className="flex gap-3">
        <div
          className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{
            backgroundColor: `${paper.journal_color}20`,
            color: paper.journal_color,
            border: `1px solid ${paper.journal_color}33`,
          }}
          aria-hidden
        >
          {avatarLabel}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {paper.journal_abbreviation}
            </span>
            <span className="text-gray-400 dark:text-gray-500">·</span>
            <span className="text-gray-500 dark:text-gray-400">
              {formatRelativeDate(paper.publication_date)}
            </span>
          </div>

          <Link href={`/paper/${paper.pmid}`}>
            <h3 className="mb-2 text-[15px] font-semibold leading-snug text-gray-900 transition-colors hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400">
              {decodeHtmlEntities(paper.title)}
            </h3>
          </Link>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            {paper.authors.length > 0 && (
              <PaperAuthors
                authors={paper.authors}
                className="text-sm text-gray-500 dark:text-gray-400"
              />
            )}
            {paper.authors.length > 0 && (
              <span className="text-gray-400 dark:text-gray-500">·</span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {paper.authors.length} authors
            </span>
            {hasAbstract && (
              <>
                <span className="text-gray-400 dark:text-gray-500">·</span>
                <button
                  onClick={() => setIsAbstractOpen((prev) => !prev)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {isAbstractOpen ? "Hide abstract" : "Show abstract"}
                </button>
              </>
            )}
          </div>

          {/* AI Summary — primary original content */}
          {paper.ai_summary && (
            <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 dark:border-blue-900/50 dark:bg-blue-950/30">
              <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                <span className="mr-1 inline-flex items-center gap-0.5 font-semibold text-blue-600 dark:text-blue-400">
                  <Sparkles className="h-3 w-3" />
                  AI 분석
                </span>
                {paper.ai_summary}
              </p>
            </div>
          )}

          {/* Abstract — collapsed by default, secondary to AI summary */}
          <div className="mt-2">
            <PaperAbstract
              abstract={paper.abstract}
              maxLength={320}
              hideWhenCollapsed
              expanded={isAbstractOpen}
              onToggle={() => setIsAbstractOpen((prev) => !prev)}
              showToggle={false}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {paper.topic_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {paper.topic_tags.map((tag) => {
                  const meta = TOPIC_META[tag] ?? TOPIC_META.others;
                  return (
                    <span
                      key={`${paper.id}-${tag}`}
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Social Stats — display only, right-aligned */}
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-0.5">
                <Bookmark className={`h-4 w-4 ${paper.is_bookmarked ? "fill-blue-500 text-blue-500 dark:fill-blue-400 dark:text-blue-400" : ""}`} />
                <span>{paper.bookmark_count ?? 0}</span>
              </span>
              <span className="flex items-center gap-0.5">
                <ThumbsUp className={`h-4 w-4 ${paper.is_liked ? "fill-blue-500 text-blue-500 dark:fill-blue-400 dark:text-blue-400" : ""}`} />
                <span>{paper.like_count ?? 0}</span>
              </span>
              <span className="flex items-center gap-0.5">
                <MessageCircle className="h-4 w-4" />
                <span>{paper.comment_count ?? 0}</span>
              </span>
              {(paper.connection_count ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-purple-500 dark:text-purple-400">
                  <Network className="h-4 w-4" />
                  <span>{paper.connection_count}</span>
                </span>
              )}
            </div>
          </div>

          {paper.citation_count !== null && paper.citation_count > 0 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Quote className="h-3.5 w-3.5" />
                {formatCitationCount(paper.citation_count)} citations
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// Memoized: the feed rebuilds the `papers` array on every render (loadMore,
// filter/tab changes), so without memo every accumulated card re-renders.
export const PaperCard = memo(PaperCardComponent);
