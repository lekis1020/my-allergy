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

interface AuthorData {
  last_name: string;
  first_name: string | null;
  initials: string | null;
  affiliation: string | null;
  position: number;
}

interface JournalData {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  slug: string;
  impact_factor: number | null;
}

interface LinkedPaper {
  pmid: string;
  title: string;
  publication_date: string;
  citation_count: number | null;
  journal_abbreviation: string;
  journal_color: string;
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

  const journal = paper.journals as unknown as JournalData;
  const authors = ((paper.paper_authors as unknown as AuthorData[]) || []);
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Link>

      <article>
        <div className="mb-4 flex items-center gap-3">
          <Badge color={journal.color}>
            {journal.abbreviation}
          </Badge>
          {journal.impact_factor && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              IF {journal.impact_factor}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100">
          {decodeHtmlEntities(String(paper.title))}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(String(paper.publication_date))}
          </span>
          {paper.citation_count !== null && Number(paper.citation_count) > 0 && (
            <span className="flex items-center gap-1">
              <Quote className="h-4 w-4" />
              {formatCitationCount(Number(paper.citation_count))} citations
            </span>
          )}
          {paper.volume && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              Vol. {String(paper.volume)}
              {paper.issue && `(${paper.issue})`}
              {paper.pages && `: ${paper.pages}`}
            </span>
          )}
        </div>

        {/* Authors */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2 dark:text-gray-100">
            Authors
          </h2>
          <div className="space-y-1">
            {authors.map((author, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {author.last_name}
                  {author.first_name && `, ${author.first_name}`}
                </span>
                {author.affiliation && (
                  <span className="text-gray-500 dark:text-gray-400">
                    {" — "}
                    {decodeHtmlEntities(author.affiliation)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Abstract */}
        {paper.abstract && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 dark:text-gray-100">
              Abstract
            </h2>
            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line dark:text-gray-300">
              {decodeHtmlEntities(String(paper.abstract))}
            </p>
          </div>
        )}

        {/* Keywords / MeSH */}
        {(((paper.keywords as string[]) ?? []).length > 0 || ((paper.mesh_terms as string[]) ?? []).length > 0) && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 dark:text-gray-100">
              Keywords
            </h2>
            <div className="flex flex-wrap gap-2">
              {[...((paper.keywords as string[]) ?? []), ...((paper.mesh_terms as string[]) ?? [])].map(
                (keyword, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  >
                    {decodeHtmlEntities(keyword)}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {/* External links */}
        <div className="mt-8 flex items-center gap-4">
          <a
            href={getPubMedUrl(pmid)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            View on PubMed <ExternalLink className="h-4 w-4" />
          </a>
          {paper.doi && (
            <a
              href={getDoiUrl(String(paper.doi))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Full Text (DOI) <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="mt-10 space-y-8">
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
        </div>
      </article>
    </div>
  );
}

function PaperListSection({
  title,
  description,
  papers,
}: {
  title: string;
  description: string;
  papers: LinkedPaper[];
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>

      {papers.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          No linked papers found in the current database window.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {papers.map((paper) => (
            <Link
              key={paper.pmid}
              href={`/paper/${paper.pmid}`}
              className="block rounded-xl border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
            >
              <div className="mb-1 flex items-center gap-2">
                <Badge color={paper.journal_color}>{paper.journal_abbreviation}</Badge>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(paper.publication_date)}
                </span>
                {paper.citation_count !== null && paper.citation_count > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    · {formatCitationCount(paper.citation_count)} citations
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                {decodeHtmlEntities(paper.title)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
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
      pmid, title, publication_date, citation_count,
      journals!inner (abbreviation, color)
    `
    )
    .in("pmid", pmids);

  const map = new Map<string, LinkedPaper>();

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const journal = row.journals as Record<string, unknown>;
    map.set(String(row.pmid), {
      pmid: String(row.pmid),
      title: String(row.title ?? ""),
      publication_date: String(row.publication_date ?? "1970-01-01"),
      citation_count:
        typeof row.citation_count === "number" ? row.citation_count : null,
      journal_abbreviation: String(journal.abbreviation ?? ""),
      journal_color: String(journal.color ?? "#6B7280"),
    });
  }

  return map;
}

function mapLinkedPapersByOrder(ids: string[], paperMap: Map<string, LinkedPaper>): LinkedPaper[] {
  const list: LinkedPaper[] = [];
  for (const id of ids) {
    const paper = paperMap.get(id);
    if (paper) list.push(paper);
  }
  return list;
}
