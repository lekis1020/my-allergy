import { useState } from "react";
import Link from "next/link";
import { PaperAuthors } from "./paper-authors";
import { PaperAbstract } from "./paper-abstract";
import { formatRelativeDate } from "@/lib/utils/date";
import { formatCitationCount } from "@/lib/utils/text";
import { getPubMedUrl, getDoiUrl } from "@/lib/utils/url";
import { TOPIC_META } from "@/lib/utils/topic-tags";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import type { PaperWithJournal } from "@/types/filters";
import { ExternalLink, Quote, Users } from "lucide-react";

interface PaperCardProps {
  paper: PaperWithJournal;
}

export function PaperCard({ paper }: PaperCardProps) {
  const [isAbstractOpen, setIsAbstractOpen] = useState(false);
  const avatarLabel = paper.journal_abbreviation
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const hasAbstract = Boolean(paper.abstract && paper.abstract.trim().length > 0);

  return (
    <article className="px-4 py-4 transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-900/70">
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
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <a
                href={getPubMedUrl(paper.pmid)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
              >
                PubMed <ExternalLink className="h-3 w-3" />
              </a>
              {paper.doi && (
                <a
                  href={getDoiUrl(paper.doi)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  DOI <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
            {paper.citation_count !== null && paper.citation_count > 0 && (
              <span className="flex items-center gap-1">
                <Quote className="h-3.5 w-3.5" />
                {formatCitationCount(paper.citation_count)} citations
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
