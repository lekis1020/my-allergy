import { useState } from "react";
import Link from "next/link";
import { PaperAuthors } from "./paper-authors";
import { PaperAbstract } from "./paper-abstract";
import { formatRelativeDate } from "@/lib/utils/date";
import { formatCitationCount } from "@/lib/utils/text";
import { TOPIC_META } from "@/lib/utils/topic-tags";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import type { PaperWithJournal } from "@/types/filters";
import { MessageCircle, Quote, Users, ThumbsDown, ThumbsUp } from "lucide-react";
import { BookmarkButton } from "./bookmark-button";
import { useFeedback } from "@/hooks/use-feedback";
import { usePaperLike } from "@/hooks/use-paper-like";

function LikeButton({ pmid, count }: { pmid: string; count: number }) {
  const { liked, count: likeCount, toggle } = usePaperLike(pmid, count);

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1 transition-colors ${
        liked
          ? "text-blue-500 dark:text-blue-400"
          : "hover:text-gray-600 dark:hover:text-gray-300"
      }`}
    >
      <ThumbsUp className="h-4 w-4" />
      <span>{likeCount}</span>
    </button>
  );
}

interface PaperCardProps {
  paper: PaperWithJournal;
}

export function PaperCard({ paper }: PaperCardProps) {
  const [isAbstractOpen, setIsAbstractOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { getFeedback, setFeedback, clearFeedback, isLoggedIn } = useFeedback();
  const currentFeedback = getFeedback(paper.pmid);

  const handleInterested = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) return;
    if (currentFeedback === "interested") {
      void clearFeedback(paper.pmid);
    } else {
      void setFeedback(paper.pmid, "interested");
    }
  };

  const handleNotInterested = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) return;
    if (currentFeedback === "not_interested") {
      void clearFeedback(paper.pmid);
    } else {
      setDismissed(true);
      void setFeedback(paper.pmid, "not_interested");
    }
  };
  const avatarLabel = paper.journal_abbreviation
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const hasAbstract = Boolean(paper.abstract && paper.abstract.trim().length > 0);

  return (
    <article
      className={`relative px-4 py-4 transition-all duration-300 hover:bg-gray-50/70 dark:hover:bg-gray-900/70 ${
        dismissed ? "pointer-events-none max-h-0 overflow-hidden py-0 opacity-0" : ""
      }`}
      aria-hidden={dismissed}
    >
      {isLoggedIn && (
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button
            type="button"
            onClick={handleInterested}
            className={`rounded-full p-1.5 transition-colors ${
              currentFeedback === "interested"
                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                : "text-gray-400 hover:bg-blue-50 hover:text-blue-500 dark:text-gray-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
            }`}
            aria-label="Interested"
            title="Interested in this paper"
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNotInterested}
            className={`rounded-full p-1.5 transition-colors ${
              currentFeedback === "not_interested"
                ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                : "text-gray-400 hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            }`}
            aria-label="Not interested"
            title="Not interested in this paper"
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
        </div>
      )}
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

          {/* AI Summary */}
          {paper.ai_summary && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-blue-500 dark:text-blue-400">AI:</span>{" "}
              {paper.ai_summary}
            </p>
          )}

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
            <div className="ml-auto" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
            {paper.citation_count !== null && paper.citation_count > 0 && (
              <span className="flex items-center gap-1">
                <Quote className="h-3.5 w-3.5" />
                {formatCitationCount(paper.citation_count)} citations
              </span>
            )}
          </div>

          {/* Social Actions */}
          <div className="flex items-center gap-5 border-t border-gray-100 pt-2.5 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
            <BookmarkButton pmid={paper.pmid} />
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <LikeButton pmid={paper.pmid} count={paper.like_count ?? 0} />
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <Link
              href={`/paper/${paper.pmid}#comments`}
              className="flex items-center gap-1 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{paper.comment_count ?? 0}</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
