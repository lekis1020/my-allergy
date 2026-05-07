import type { Metadata } from "next";
import { createAnonClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { getPubMedUrl, getDoiUrl } from "@/lib/utils/url";
import { formatCitationCount } from "@/lib/utils/text";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import { ArrowLeft, ExternalLink, Calendar, Quote, BookOpen, FileText, Download, Sparkles, Info } from "lucide-react";
import { findOpenAccessPdf } from "@/lib/pubmed/open-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaperActions } from "@/components/papers/paper-actions";
import { StructuredAbstract } from "@/components/papers/structured-abstract";
import { CollapsibleAbstract } from "@/components/papers/collapsible-abstract";
import { CommentThread } from "@/components/comments/comment-thread";
import { AuthorsList } from "@/components/papers/authors-list";
import {
  PaperListSection,
  type LinkedPaper,
} from "@/components/papers/paper-list-section";
import { PaperChat } from "@/components/chat/paper-chat";
import { ConnectionGraphPreview } from "@/components/graph/connection-graph-preview";

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-allergy.vercel.app";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pmid } = await params;
  const supabase = createAnonClient();

  const { data: paper } = await supabase
    .from("papers")
    .select("title, abstract, ai_summary, journals!inner (name, abbreviation)")
    .eq("pmid", pmid)
    .single();

  if (!paper) {
    return { title: "Paper Not Found" };
  }

  const title = decodeHtmlEntities(String(paper.title));
  const description = paper.ai_summary
    ? String(paper.ai_summary)
    : paper.abstract
      ? decodeHtmlEntities(String(paper.abstract)).slice(0, 200) + "..."
      : `Research paper from ${paper.journals.name}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${SITE_URL}/paper/${pmid}`,
      siteName: "My Allergy",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `${SITE_URL}/paper/${pmid}`,
    },
  };
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
  const keywords = (paper.keywords as string[] | null) ?? [];
  const meshTerms = (paper.mesh_terms as string[] | null) ?? [];
  const allTags = [...keywords, ...meshTerms];

  // Citation relationships from DB + bookmark status + open access check
  const [referencesPapers, citedByPapers, bookmarkedPmids, openAccess] = await Promise.all([
    findCitationsFromDb(supabase, pmid, "references").catch(() => [] as LinkedPaper[]),
    findCitationsFromDb(supabase, pmid, "cited_by").catch(() => [] as LinkedPaper[]),
    loadBookmarkedPmids(supabase).catch(() => new Set<string>()),
    findOpenAccessPdf(paper.doi as string | null, pmid).catch(() => null),
  ]);
  const hasCitations = referencesPapers.length + citedByPapers.length > 0;

  const externalLinks = (
    <div className="flex flex-wrap items-center gap-2">
      {openAccess?.pdfUrl && (
        <a
          href={openAccess.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
        >
          <Download className="h-3 w-3" />
          PDF {openAccess.license && (
            <span className="rounded bg-emerald-700/30 px-1 py-0.5 text-[10px] dark:bg-emerald-400/20">
              {openAccess.license.replace("cc-", "CC ").toUpperCase()}
            </span>
          )}
        </a>
      )}
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

  const decodedTitle = decodeHtmlEntities(String(paper.title));
  const firstAuthor = authors.length > 0
    ? `${authors[0].last_name}${authors[0].first_name ? ` ${authors[0].first_name}` : ""}`
    : null;

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: decodedTitle,
    ...(paper.abstract && { abstract: decodeHtmlEntities(String(paper.abstract)).slice(0, 500) }),
    datePublished: displayPublicationDate,
    ...(paper.doi && { identifier: { "@type": "PropertyValue", propertyID: "DOI", value: String(paper.doi) } }),
    url: `${SITE_URL}/paper/${pmid}`,
    isPartOf: {
      "@type": "Periodical",
      name: journal.name,
    },
    ...(firstAuthor && { author: { "@type": "Person", name: firstAuthor } }),
    publisher: { "@type": "Organization", name: "My Allergy" },
    ...(paper.ai_summary && { description: String(paper.ai_summary) }),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
            {Array.isArray(paper.publication_types) && paper.publication_types.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                <FileText className="h-3 w-3" />
                {(paper.publication_types as string[]).join(", ")}
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

          <h1 className="text-3xl font-bold leading-tight text-gray-900 lg:text-[2.75rem] lg:leading-tight dark:text-gray-100">
            {decodedTitle}
          </h1>
        </header>

        {/* 2-column grid: content + sticky sidebar on lg+ */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* LEFT — main content */}
          <main className="min-w-0 space-y-6">
            {/* Authors — collapsible if ≥ 10 */}
            <AuthorsList authors={authors} collapseThreshold={10} />

            {/* AI 핵심 요약 — primary original content, right after authors */}
            {paper.ai_summary && (
              <section className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5 dark:border-blue-800/50 dark:from-blue-950/40 dark:to-indigo-950/30">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  AI 핵심 요약
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                    My Allergy 오리지널
                  </span>
                </h2>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {paper.ai_summary}
                </p>
              </section>
            )}

            {/* AI 추가 요약 버튼 + 북마크 */}
            {paper.abstract && (
              <PaperActions
                pmid={pmid}
                abstract={String(paper.abstract)}
                title={String(paper.title)}
              />
            )}

            {/* AI 채팅 — AI 요약 섹션 바로 아래 */}
            <PaperChat pmid={pmid} isOa={!!openAccess?.pdfUrl} />

            {/* Source attribution */}
            <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-4 py-2.5 text-xs text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>
                아래 초록(Abstract)은{" "}
                <a href={getPubMedUrl(pmid)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                  PubMed
                </a>
                에서 제공하는 원문 데이터입니다. AI 분석은 My Allergy에서 독자적으로 생성한 콘텐츠입니다.
              </p>
            </div>

            {/* Abstract — collapsible, secondary to AI analysis */}
            {paper.abstract && (
              <CollapsibleAbstract>
                <StructuredAbstract text={decodeHtmlEntities(String(paper.abstract))} />
              </CollapsibleAbstract>
            )}

            {/* Comments */}
            <section id="comments">
              <CommentThread pmid={pmid} />
            </section>

            {/* Mobile-only: keywords, external links, related papers */}
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

              <ConnectionGraphPreview pmid={pmid} />

              {hasCitations && (
                <>
                  {referencesPapers.length > 0 && (
                    <PaperListSection
                      title={`이 논문이 인용한 논문 (DB 내 ${referencesPapers.length}편)`}
                      description="데이터베이스에 수록된 참고문헌"
                      papers={referencesPapers}
                      bookmarkedPmids={bookmarkedPmids}
                    />
                  )}
                  {citedByPapers.length > 0 && (
                    <PaperListSection
                      title={`이 논문을 인용한 논문 (DB 내 ${citedByPapers.length}편)`}
                      description="데이터베이스에 수록된 인용 논문"
                      papers={citedByPapers}
                      bookmarkedPmids={bookmarkedPmids}
                    />
                  )}
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

              <ConnectionGraphPreview pmid={pmid} />

              {hasCitations && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                  <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Citation Graph (DB 내)
                  </h2>

                  {referencesPapers.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-2 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                        이 논문이 인용 ({referencesPapers.length})
                      </p>
                      <div className="space-y-1.5">
                        {referencesPapers.slice(0, 5).map((rp) => (
                          <Link
                            key={rp.pmid}
                            href={`/paper/${rp.pmid}`}
                            className="group block rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/60"
                          >
                            <div className="mb-0.5 flex items-center gap-1.5">
                              {bookmarkedPmids.has(rp.pmid) && (
                                <span className="text-[10px] text-amber-500" title="북마크됨">★</span>
                              )}
                              <Badge color={rp.journal_color}>{rp.journal_abbreviation}</Badge>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                {/^(\d{4})/.exec(rp.epub_date ?? rp.publication_date)?.[1] ?? ""}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-xs text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-gray-100">
                              {decodeHtmlEntities(rp.title)}
                            </p>
                          </Link>
                        ))}
                        {referencesPapers.length > 5 && (
                          <p className="pl-2 text-[11px] text-gray-400">
                            +{referencesPapers.length - 5}편 더
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {citedByPapers.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                        이 논문을 인용 ({citedByPapers.length})
                      </p>
                      <div className="space-y-1.5">
                        {citedByPapers.slice(0, 5).map((rp) => (
                          <Link
                            key={rp.pmid}
                            href={`/paper/${rp.pmid}`}
                            className="group block rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/60"
                          >
                            <div className="mb-0.5 flex items-center gap-1.5">
                              {bookmarkedPmids.has(rp.pmid) && (
                                <span className="text-[10px] text-amber-500" title="북마크됨">★</span>
                              )}
                              <Badge color={rp.journal_color}>{rp.journal_abbreviation}</Badge>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                {/^(\d{4})/.exec(rp.epub_date ?? rp.publication_date)?.[1] ?? ""}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-xs text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-gray-100">
                              {decodeHtmlEntities(rp.title)}
                            </p>
                          </Link>
                        ))}
                        {citedByPapers.length > 5 && (
                          <p className="pl-2 text-[11px] text-gray-400">
                            +{citedByPapers.length - 5}편 더
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}

/**
 * Find papers that cite or are cited by the given paper, from paper_citations table.
 */
async function findCitationsFromDb(
  supabase: ReturnType<typeof createAnonClient>,
  pmid: string,
  direction: "references" | "cited_by"
): Promise<LinkedPaper[]> {
  // references: this paper cites others (source=this, target=others)
  // cited_by: others cite this paper (source=others, target=this)
  const column = direction === "references" ? "source_pmid" : "target_pmid";
  const linkedColumn = direction === "references" ? "target_pmid" : "source_pmid";

  const { data: citations } = await supabase
    .from("paper_citations")
    .select(linkedColumn)
    .eq(column, pmid);

  if (!citations || citations.length === 0) return [];

  const linkedPmids = citations.map((row) =>
    String(row[linkedColumn as keyof typeof row])
  );

  const { data: papers } = await supabase
    .from("papers")
    .select(`
      pmid, title, publication_date, epub_date, citation_count,
      journals!inner (abbreviation, color)
    `)
    .in("pmid", linkedPmids)
    .order("epub_date", { ascending: false });

  return (papers ?? []).map((row) => {
    const journal = row.journals;
    return {
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
    };
  });
}

/**
 * Load all bookmarked PMIDs for the current user (anonymous-safe).
 */
async function loadBookmarkedPmids(
  supabase: ReturnType<typeof createAnonClient>
): Promise<Set<string>> {
  const { data } = await supabase
    .from("bookmarks")
    .select("pmid");

  return new Set((data ?? []).map((row) => String(row.pmid)));
}

function resolveDisplayedPublicationDate(
  epubDate: string | null | undefined,
  publicationDate: string | null | undefined,
): string {
  return epubDate || publicationDate || "1970-01-01";
}
