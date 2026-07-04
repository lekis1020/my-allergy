import type { Metadata } from "next";
import { createAnonClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { getPubMedUrl, getDoiUrl } from "@/lib/utils/url";
import { formatCitationCount } from "@/lib/utils/text";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import { ArrowLeft, ExternalLink, Calendar, Quote, BookOpen, FileText, Download, Info } from "lucide-react";
import { findOpenAccessPdf } from "@/lib/pubmed/open-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaperActions } from "@/components/papers/paper-actions";
import { BookmarkButton } from "@/components/papers/bookmark-button";
import { LikeButton } from "@/components/papers/like-button";
import { StructuredAbstract } from "@/components/papers/structured-abstract";
import { CommentThread } from "@/components/comments/comment-thread";
import { AuthorsList } from "@/components/papers/authors-list";
import {
  PaperListSection,
  type LinkedPaper,
} from "@/components/papers/paper-list-section";
import { PaperChat } from "@/components/chat/paper-chat";
import { ConnectionGraphPreview } from "@/components/graph/connection-graph-preview";
import {
  findCitationsFromDb,
  loadBookmarkedPmids,
  resolveDisplayedPublicationDate,
} from "./paper-data";

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

  const paperInteractions = (
    <div className="flex items-center gap-2">
      <LikeButton pmid={pmid} size="md" />
      <BookmarkButton
        pmid={pmid}
        size="md"
        aiSummary={paper.ai_summary ? String(paper.ai_summary) : null}
      />
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

            {/* Unified AI summary card: 한 줄 요약 (paper.ai_summary) + 상세 분석 (on-demand toggle) */}
            <PaperActions
              pmid={pmid}
              abstract={paper.abstract ? String(paper.abstract) : null}
              title={String(paper.title)}
              aiSummary={paper.ai_summary ? String(paper.ai_summary) : null}
            />

            {/* AI 채팅 — AI 요약 섹션 바로 아래 */}
            <PaperChat pmid={pmid} isOa={!!openAccess?.pdfUrl} />

            {/* Abstract — always visible, secondary to AI analysis */}
            {paper.abstract && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Original Abstract
                </h2>
                <StructuredAbstract text={decodeHtmlEntities(String(paper.abstract))} />
              </section>
            )}

            {/* Comments */}
            <section id="comments">
              <CommentThread pmid={pmid} />
            </section>

            {/* Mobile-only: keywords, external links, related papers */}
            <div className="space-y-8 lg:hidden">

              <ConnectionGraphPreview pmid={pmid} />

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

              <section>
                <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  이 논문
                </h2>
                {paperInteractions}
              </section>

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

            {/* Consolidated AI / source / medical disclaimer — single source of truth,
                replaces the per-card disclaimers previously shown inside each AI summary. */}
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>
                ⚠️ 본 페이지의 <strong>AI 요약(한 줄 요약·상세 분석)</strong>은 모두 AI가 자동 생성한 콘텐츠이며 오류가 있을 수 있습니다. 의학적 판단의 근거로 사용하지 마시고 원문(Abstract/Full Text)을 직접 확인하세요. 초록(Abstract)은{" "}
                <a href={getPubMedUrl(pmid)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                  PubMed
                </a>
                에서 제공하는 원문 데이터로 저작권은 각 저널에 귀속되며, AI 분석은 My Allergy에서 독자적으로 생성한 콘텐츠입니다. 본 사이트의 모든 정보는 의료 전문가의 참고용이며 의료 조언·진단·치료를 대체하지 않습니다.
              </p>
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

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  이 논문
                </h2>
                {paperInteractions}
              </div>

              <ConnectionGraphPreview pmid={pmid} />

              {allTags.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Keywords
                  </h2>
                  {keywordChips}
                </div>
              )}

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
