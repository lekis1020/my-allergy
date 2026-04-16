import { createAnonClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { getPubMedUrl, getDoiUrl } from "@/lib/utils/url";
import { formatCitationCount } from "@/lib/utils/text";
import { fetchLinkedPmids } from "@/lib/pubmed/links";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import { ArrowLeft, ExternalLink, Calendar, Quote, BookOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaperActions } from "@/components/papers/paper-actions";
import { CommentThread } from "@/components/comments/comment-thread";
import { AuthorsList } from "@/components/papers/authors-list";
import { CitationGraph } from "@/components/papers/citation-graph";
import {
  PaperListSection,
  type LinkedPaper,
} from "@/components/papers/paper-list-section";

interface AuthorData {
  last_name: string;
  first_name: string | null;
  initials: string | null;
  affiliation: string | null;
  position: number;
}

// Revalidate every hour — paper data is essentially immutable once synced
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ pmid: string }>;
}

export default async function PaperDetailPage({ params }: PageProps) {
  const { pmid } = await params;
  const supabase = createAnonClient();

  const { data: paper, error } = await supabase
    .from("papers")
    .select(
      `
      *,
      journals!inner (id, name, abbreviation, color, slug, impact_factor),
      paper_authors (last_name, first_name, initials, affiliation, position)
    `
    )
    .eq("pmid", pmid)
    .order("position", { referencedTable: "paper_authors", ascending: true })
    .single();

  if (error || !paper) {
    notFound();
  }

  const journal = paper.journals;
  const authors: AuthorData[] = paper.paper_authors || [];
  const displayPublicationDate = resolveDisplayedPublicationDate(
    paper.epub_date as string | null | undefined,
    paper.publication_date as string | null | undefined,
  );
  const [relatedIds, referencedIds, citedByIds] = await Promise.all([
    fetchLinkedPmids(pmid, "pubmed_pubmed", 30),
    fetchLinkedPmids(pmid, "pubmed_pubmed_refs", 30),
    fetchLinkedPmids(pmid, "pubmed_pubmed_citedin", 30),
  ]);

  const linkedPapersMap = await getLinkedPapersMap(
    supabase,
    [...new Set([...relatedIds, ...referencedIds, ...citedByIds])]
  );

  const relatedPapers = mapLinkedPapersByOrder(relatedIds, linkedPapersMap).slice(0, 10);
  const referencedPapers = mapLinkedPapersByOrder(referencedIds, linkedPapersMap).slice(0, 10);
  const citedByPapers = mapLinkedPapersByOrder(citedByIds, linkedPapersMap).slice(0, 10);

  const keywords = (paper.keywords as string[] | null) ?? [];
  const meshTerms = (paper.mesh_terms as string[] | null) ?? [];
  const allTags = [...keywords, ...meshTerms];
  const hasLinkedPapers =
    relatedPapers.length + referencedPapers.length + citedByPapers.length > 0;

  const externalLinks = (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={getPubMedUrl(pmid)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
      >
        PubMed <ExternalLink className="h-3 w-3" />
      </a>
      {paper.doi && (
        <a
          href={getDoiUrl(String(paper.doi))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Full Text (DOI) <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );

  const keywordChips = allTags.length > 0 && (
    <div className="flex flex-wrap gap-1.5">
      {allTags.map((keyword, i) => (
        <span
          key={i}
          className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        >
          {decodeHtmlEntities(keyword)}
        </span>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Link>

      <article>
        {/* Hero — full width on all viewports */}
        <header className="mb-6 lg:mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge color={journal.color}>{journal.abbreviation}</Badge>
            {journal.impact_factor && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                IF {journal.impact_factor}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(displayPublicationDate)}
            </span>
            {paper.citation_count !== null && Number(paper.citation_count) > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Quote className="h-3.5 w-3.5" />
                {formatCitationCount(Number(paper.citation_count))} citations
              </span>
            )}
            {paper.volume && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <BookOpen className="h-3.5 w-3.5" />
                Vol. {String(paper.volume)}
                {paper.issue ? `(${paper.issue})` : ""}
                {paper.pages ? `: ${paper.pages}` : ""}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold leading-tight text-gray-900 lg:text-3xl dark:text-gray-100">
            {decodeHtmlEntities(String(paper.title))}
          </h1>
        </header>

        {/* 2-column grid: content + sticky sidebar on lg+ */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* LEFT — main content */}
          <main className="min-w-0 space-y-6">
            {/* Authors — collapsible if ≥ 10 */}
            <AuthorsList authors={authors} collapseThreshold={10} />

            {/* AI summary + bookmark (all viewports, between Authors and Abstract) */}
            {paper.abstract && (
              <PaperActions
                pmid={pmid}
                abstract={String(paper.abstract)}
                title={String(paper.title)}
              />
            )}

            {/* Abstract */}
            {paper.abstract && (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Abstract
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {decodeHtmlEntities(String(paper.abstract))}
                </p>
              </section>
            )}

            {/* Comments — moved up from bottom */}
            <section id="comments">
              <CommentThread pmid={pmid} />
            </section>

            {/* Mobile-only: keywords, external links, related papers (full cards) */}
            <div className="space-y-8 lg:hidden">
              {allTags.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Keywords
                  </h2>
                  {keywordChips}
                </section>
              )}

              <section>
                <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  External links
                </h2>
                {externalLinks}
              </section>

              {hasLinkedPapers && (
                <>
                  <PaperListSection
                    title="Related Papers"
                    description="PubMed similar articles that are contextually related."
                    papers={relatedPapers}
                  />
                  <PaperListSection
                    title="Referenced by This Paper"
                    description="Papers listed in this article's PubMed reference links."
                    papers={referencedPapers}
                  />
                  <PaperListSection
                    title="Cited by This Paper"
                    description="PubMed papers that cite this article."
                    papers={citedByPapers}
                  />
                </>
              )}
            </div>
          </main>

          {/* RIGHT — sticky sidebar, desktop only */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-6 overflow-y-auto overscroll-contain pr-1">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  External links
                </h2>
                {externalLinks}
              </div>

              {allTags.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Keywords
                  </h2>
                  {keywordChips}
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                <CitationGraph
                  thisPaper={{
                    title: String(paper.title),
                    journalAbbreviation: journal.abbreviation,
                    journalColor: journal.color,
                    publicationDate: displayPublicationDate,
                  }}
                  references={referencedPapers}
                  citations={citedByPapers}
                  maxPerSide={5}
                />
              </div>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}

async function getLinkedPapersMap(
  supabase: ReturnType<typeof createAnonClient>,
  pmids: string[]
): Promise<Map<string, LinkedPaper>> {
  if (pmids.length === 0) return new Map();

  const { data } = await supabase
    .from("papers")
    .select(
      `
      pmid, title, publication_date, epub_date, citation_count,
      journals!inner (abbreviation, color)
    `
    )
    .in("pmid", pmids);

  const map = new Map<string, LinkedPaper>();

  for (const row of (data ?? [])) {
    const journal = row.journals;
    map.set(String(row.pmid), {
      pmid: String(row.pmid),
      title: String(row.title ?? ""),
      publication_date: String(row.publication_date ?? "1970-01-01"),
      epub_date:
        typeof row.epub_date === "string" && row.epub_date.length > 0
          ? row.epub_date
          : null,
      citation_count:
        typeof row.citation_count === "number" ? row.citation_count : null,
      journal_abbreviation: String(journal.abbreviation ?? ""),
      journal_color: String(journal.color ?? "#6B7280"),
    });
  }

  return map;
}

function resolveDisplayedPublicationDate(
  epubDate: string | null | undefined,
  publicationDate: string | null | undefined,
): string {
  return epubDate || publicationDate || "1970-01-01";
}

function mapLinkedPapersByOrder(ids: string[], paperMap: Map<string, LinkedPaper>): LinkedPaper[] {
  const list: LinkedPaper[] = [];
  for (const id of ids) {
    const paper = paperMap.get(id);
    if (paper) list.push(paper);
  }
  return list;
}
