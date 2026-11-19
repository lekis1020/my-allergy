import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenCheck } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { ScenarioTable } from "@/components/reference/scenario-table";
import {
  REFERENCE_SHEETS,
  getSheet,
  isPublished,
  lastReviewedOn,
} from "@/lib/reference";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return REFERENCE_SHEETS.map((sheet) => ({ slug: sheet.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sheet = getSheet(slug);
  if (!sheet) return {};

  return {
    title: sheet.title,
    description: sheet.question,
    robots: isPublished(sheet) ? undefined : { index: false },
  };
}

export default async function ReferenceSheetPage({ params }: PageProps) {
  const { slug } = await params;
  const sheet = getSheet(slug);
  if (!sheet) notFound();

  const reviewedOn = lastReviewedOn(sheet);
  const relatedPapersHref = `/?${new URLSearchParams({
    q: sheet.relatedQuery,
    sort: "date_desc",
  })}`;

  return (
    <PageShell
      title={sheet.title}
      icon={<BookOpenCheck className="h-5 w-5 text-blue-500" />}
      variant="narrow"
    >
      <div className="space-y-3 border-b border-gray-200 px-4 py-4 dark:border-gray-800">
        <Link
          href="/reference"
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          All sheets
        </Link>
        <p className="text-base font-medium text-gray-900 dark:text-gray-100">
          {sheet.question}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            {reviewedOn === null ? "Not yet reviewed" : `Last reviewed ${reviewedOn}`}
          </span>
          <Link
            href={relatedPapersHref}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Related papers
          </Link>
        </div>
      </div>

      <ScenarioTable rows={sheet.rows} />

      <div className="px-4 py-6">
        <MedicalDisclaimer />
      </div>
    </PageShell>
  );
}

function MedicalDisclaimer() {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-gray-700 dark:border-red-800 dark:bg-red-900/20 dark:text-gray-300">
      <p className="mb-2 font-semibold text-red-800 dark:text-red-300">
        본 서비스는 의료 조언을 제공하지 않습니다.
      </p>
      <p>
        서비스에 게시된 모든 콘텐츠는 학술 연구 정보 제공을 목적으로 합니다.
        특정 환자의 진단, 치료, 예방에 관한 의료적 판단을 대체하지 않으며,
        의료 전문가의 직접적인 진료를 대신하지 않습니다. 건강 관련
        결정은 반드시 담당 의료 전문가와 상의하시기 바랍니다.
      </p>
      <Link
        href="/terms"
        className="mt-2 inline-block text-blue-600 hover:underline dark:text-blue-400"
      >
        이용약관
      </Link>
    </div>
  );
}
