import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenCheck } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { CatalogList } from "@/components/reference/catalog-list";
import { CatalogSearch } from "@/components/reference/catalog-search";
import { ConditionChips } from "@/components/reference/condition-chips";
import { MedicalDisclaimer } from "@/components/reference/medical-disclaimer";
import { activeCondition, reviewStatusLabel } from "@/lib/reference/catalog";
import {
  REFERENCE_SCREENS,
  getScreen,
  isPublished,
  reviewState,
} from "@/lib/reference";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string | string[]; condition?: string | string[] }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return REFERENCE_SCREENS.map((screen) => ({ slug: screen.slug }));
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const screen = getScreen(slug);
  if (!screen) return {};

  return {
    title: screen.title,
    description: screen.question,
    robots: isPublished(screen) ? undefined : { index: false },
  };
}

export default async function ReferenceCatalogPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const screen = getScreen(slug);
  if (!screen) notFound();

  const rawParams = await searchParams;
  const query = firstParam(rawParams.q);
  const condition = activeCondition(screen, firstParam(rawParams.condition));
  const relatedPapersHref = `/?${new URLSearchParams({
    q: screen.relatedQuery,
    sort: "date_desc",
  })}`;
  const status = reviewStatusLabel(reviewState(screen));

  return (
    <PageShell
      title={screen.title}
      icon={<BookOpenCheck className="h-5 w-5 text-blue-500" />}
      variant="narrow"
      stickyHeader="desktop"
    >
      <div className="flex flex-col">
        <div className="order-2 space-y-3 border-b border-gray-200 px-4 py-4 md:order-1 dark:border-gray-800">
          <Link
            href="/reference"
            className="inline-flex min-h-11 items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            All sheets
          </Link>
          <p className="hidden text-base font-medium text-gray-900 md:block dark:text-gray-100">
            {screen.question}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-gray-500 dark:text-gray-400">{status}</span>
            <Link
              href={relatedPapersHref}
              className="inline-flex min-h-11 items-center text-blue-600 hover:underline dark:text-blue-400"
            >
              Related papers
            </Link>
          </div>
        </div>

        <div className="order-1 sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:order-2 md:bg-transparent dark:border-gray-800 dark:bg-gray-950/90 md:dark:bg-transparent">
          <CatalogSearch
            initialQuery={query}
            condition={condition}
            subject={screen.subject}
          />
          {screen.grouping === "condition" ? (
            <ConditionChips screen={screen} query={query} condition={condition} />
          ) : null}
        </div>

        <div className="order-3">
          <CatalogList screen={screen} query={query} condition={condition} />
        </div>
      </div>

      <div className="px-4 py-6">
        <MedicalDisclaimer />
      </div>
    </PageShell>
  );
}
