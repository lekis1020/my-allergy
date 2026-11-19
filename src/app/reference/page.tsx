import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { SourcePendingBadge } from "@/components/reference/scenario-table";
import {
  REFERENCE_SHEETS,
  isPublished,
  reviewState,
  type ReviewState,
} from "@/lib/reference";

export const metadata: Metadata = {
  title: "Clinical Reference",
  description:
    "Lookup sheets for allergists. Each entry shows its source and review date.",
  robots: REFERENCE_SHEETS.some(isPublished) ? undefined : { index: false },
};

export default function ReferencePage() {
  return (
    <PageShell
      title="Clinical Reference"
      subtitle="Lookup sheets for allergists"
      icon={<BookOpenCheck className="h-5 w-5 text-blue-500" />}
      variant="narrow"
    >
      <ul className="space-y-3 px-4 py-6">
        {REFERENCE_SHEETS.map((sheet) => {
          const state = reviewState(sheet);
          return (
            <li key={sheet.slug}>
              <Link
                href={`/reference/${sheet.slug}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700 dark:hover:bg-gray-900/50"
              >
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {sheet.title}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {sheet.question}
                </p>
                <div className="mt-3">
                  <ReviewStatus state={state} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}

function ReviewStatus({ state }: { state: ReviewState }) {
  if (state.kind === "pending") return <SourcePendingBadge />;
  return (
    <span className="text-xs text-gray-500 dark:text-gray-400">
      {state.kind === "cited"
        ? `Citations checked ${state.checkedOn} · not yet clinically reviewed`
        : `Reviewed ${state.reviewedOn}`}
    </span>
  );
}
