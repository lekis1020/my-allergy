import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenCheck } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { MedicalDisclaimer } from "@/components/reference/medical-disclaimer";
import { SourcePendingBadge } from "@/components/reference/scenario-table";
import { SourceCitations } from "@/components/reference/source-citations";
import {
  activeCondition,
  catalogHref,
  entryReviewLine,
  entryStatusLabel,
} from "@/lib/reference/catalog";
import { REFERENCE_SCREENS, getEntry } from "@/lib/reference";
import type { CatalogEntry, CatalogScreen } from "@/lib/reference/types";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ q?: string | string[]; condition?: string | string[] }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return REFERENCE_SCREENS.flatMap((screen) =>
    screen.entries.map((entry) => ({ slug: screen.slug, id: entry.id })),
  );
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, id } = await params;
  const match = getEntry(slug, id);
  if (!match) return {};
  return {
    title: `${match.entry.label} · ${match.screen.title}`,
    description: match.screen.question,
    robots:
      match.entry.identity.status === "sourced" &&
      match.entry.identity.reviewedBy !== undefined
        ? undefined
        : { index: false },
  };
}

export default async function CatalogEntryPage({ params, searchParams }: PageProps) {
  const { slug, id } = await params;
  const match = getEntry(slug, id);
  if (!match) notFound();

  const rawParams = await searchParams;
  const query = firstParam(rawParams.q);
  const condition = activeCondition(match.screen, firstParam(rawParams.condition));
  const { screen, entry } = match;

  return (
    <PageShell
      title={screen.title}
      icon={<BookOpenCheck className="h-5 w-5 text-blue-500" />}
      variant="narrow"
      stickyHeader="desktop"
    >
      <div className="space-y-4 px-4 py-4">
        <Link
          href={catalogHref(screen.slug, query, condition)}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {screen.title}
        </Link>
        <EntryBody screen={screen} entry={entry} />
      </div>
      <div className="px-4 py-6">
        <MedicalDisclaimer />
      </div>
    </PageShell>
  );
}

function EntryBody({ screen, entry }: { screen: CatalogScreen; entry: CatalogEntry }) {
  if (screen.subject === "tool") return <ToolDetail entry={entry} />;
  if (screen.subject === "allergen") return <AllergenDetail entry={entry} />;
  return <CrossReactionDetail screen={screen} entry={entry} />;
}

function ToolDetail({ entry }: { entry: CatalogEntry }) {
  const review = entryReviewLine(entry);
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{entry.label}</h2>
        {entry.identity.status === "sourced" ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">{entry.identity.name}</p>
        ) : null}
        {entry.groupLabel ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{entry.groupLabel}</p>
        ) : null}
        <p className="text-sm text-gray-500 dark:text-gray-400">{entryStatusLabel(entry)}</p>
      </header>
      {entry.identity.status === "sourced" ? (
        <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          <p>{entry.identity.guidance}</p>
          <SourceCitations sourceIds={entry.identity.sourceIds} entryId={entry.id} />
          {review.kind !== "pending" ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">{review.line}</p>
          ) : null}
        </div>
      ) : (
        <SourcePendingBadge />
      )}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        Calculator: Source pending. The scoring rules are not yet cited from the full instrument.
      </div>
    </div>
  );
}

function CrossReactionDetail({
  screen,
  entry,
}: {
  screen: CatalogScreen;
  entry: CatalogEntry;
}) {
  const pending = entry.identity.status !== "sourced";
  const noun = screen.subject === "agent" ? "agent" : "drug";
  const empty = `The attached sources place no ${noun} in this group.`;
  const coverage =
    screen.subject === "agent"
      ? "Agents not listed are not covered by the attached sources."
      : "Drugs not listed are not covered by the attached sources.";

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Reaction to {entry.label}
        </h2>
        {entry.groupLabel ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{entry.groupLabel}</p>
        ) : null}
        <p className="text-sm text-gray-500 dark:text-gray-400">{entryStatusLabel(entry)}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Pane title="Safer to use" pending={pending} empty={empty} />
        <Pane title="High chance of cross-reaction" pending={pending} empty={empty} />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">{coverage}</p>
    </div>
  );
}

function Pane({
  title,
  pending,
  empty,
}: {
  title: string;
  pending: boolean;
  empty: string;
}) {
  return (
    <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="mt-3">{pending ? <SourcePendingBadge /> : <p className="text-sm">{empty}</p>}</div>
    </section>
  );
}

function AllergenDetail({ entry }: { entry: CatalogEntry }) {
  const pending = entry.identity.status !== "sourced";
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{entry.label}</h2>
        {pending ? <SourcePendingBadge /> : null}
      </header>
      <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Components</h3>
        {pending ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Component X1</p>
            <SourcePendingBadge />
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            The attached sources list no cross-reactivity for this allergen.
          </p>
        )}
      </section>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Allergens not listed are not covered by the attached sources.
      </p>
    </div>
  );
}
