import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import type { LinkedPaper } from "./paper-list-section";

interface CitationGraphProps {
  thisPaper: {
    title: string;
    journalAbbreviation: string;
    journalColor: string;
    publicationDate: string;
  };
  references: LinkedPaper[];
  citations: LinkedPaper[];
  maxPerSide?: number;
}

function year(date: string): string {
  return /^(\d{4})/.exec(date)?.[1] ?? "";
}

function TreeRow({ paper }: { paper: LinkedPaper }) {
  return (
    <Link
      href={`/paper/${paper.pmid}`}
      className="group relative flex items-start gap-2 py-1.5 pl-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/60"
    >
      {/* Connector node on the stem */}
      <span
        aria-hidden
        className="absolute left-[-5px] top-[14px] h-2 w-2 rounded-full border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-950"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <Badge color={paper.journal_color}>{paper.journal_abbreviation}</Badge>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {year(paper.epub_date ?? paper.publication_date)}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-gray-100">
          {decodeHtmlEntities(paper.title)}
        </p>
      </div>
    </Link>
  );
}

export function CitationGraph({
  thisPaper,
  references,
  citations,
  maxPerSide = 5,
}: CitationGraphProps) {
  const shownRefs = references.slice(0, maxPerSide);
  const shownCites = citations.slice(0, maxPerSide);
  const hiddenRefs = references.length - shownRefs.length;
  const hiddenCites = citations.length - shownCites.length;

  return (
    <section>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Citation graph
      </h2>

      {/* References — this paper cites */}
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
        <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
          <path d="M5 1 L5 9 M2 6 L5 9 L8 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>This paper cites ({references.length})</span>
      </div>
      <div className="ml-3 border-l border-dashed border-gray-300 dark:border-gray-700">
        {shownRefs.length === 0 ? (
          <p className="py-1.5 pl-3 text-[11px] text-gray-400 dark:text-gray-500">
            No references indexed.
          </p>
        ) : (
          shownRefs.map((paper) => <TreeRow key={paper.pmid} paper={paper} />)
        )}
        {hiddenRefs > 0 && (
          <p className="py-1.5 pl-3 text-[11px] text-gray-400 dark:text-gray-500">
            +{hiddenRefs} more references
          </p>
        )}
      </div>

      {/* Center node — this paper */}
      <div className="ml-3 flex items-center">
        <span
          aria-hidden
          className="block h-6 w-px border-l border-dashed border-gray-300 dark:border-gray-700"
        />
      </div>
      <div
        className="rounded-lg border-2 border-blue-400 bg-blue-50 px-3 py-2 shadow-sm dark:border-blue-500 dark:bg-blue-950/40"
      >
        <div className="mb-0.5 flex items-center gap-1.5">
          <Badge color={thisPaper.journalColor}>
            {thisPaper.journalAbbreviation}
          </Badge>
          <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
            {year(thisPaper.publicationDate)} · THIS PAPER
          </span>
        </div>
        <p className="line-clamp-2 text-xs font-semibold text-gray-900 dark:text-gray-100">
          {decodeHtmlEntities(thisPaper.title)}
        </p>
      </div>
      <div className="ml-3 flex items-center">
        <span
          aria-hidden
          className="block h-6 w-px border-l border-dashed border-gray-300 dark:border-gray-700"
        />
      </div>

      {/* Citations — papers citing this */}
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
        <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
          <path d="M5 9 L5 1 M2 4 L5 1 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Cited by ({citations.length})</span>
      </div>
      <div className="ml-3 border-l border-dashed border-gray-300 dark:border-gray-700">
        {shownCites.length === 0 ? (
          <p className="py-1.5 pl-3 text-[11px] text-gray-400 dark:text-gray-500">
            No citations yet.
          </p>
        ) : (
          shownCites.map((paper) => <TreeRow key={paper.pmid} paper={paper} />)
        )}
        {hiddenCites > 0 && (
          <p className="py-1.5 pl-3 text-[11px] text-gray-400 dark:text-gray-500">
            +{hiddenCites} more citing papers
          </p>
        )}
      </div>
    </section>
  );
}
