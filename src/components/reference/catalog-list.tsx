import Link from "next/link";
import { SourcePendingBadge } from "@/components/reference/scenario-table";
import { SourceButton } from "@/components/reference/source-button";
import {
  catalogHref,
  entryReviewLine,
  filterCatalogEntries,
  groupCatalog,
  noMatchMessage,
} from "@/lib/reference/catalog";
import type { CatalogEntry, CatalogScreen } from "@/lib/reference/types";

export function CatalogList({
  screen,
  query,
  condition,
}: {
  screen: CatalogScreen;
  query: string;
  condition: string | null;
}) {
  const entries = filterCatalogEntries(screen, query, condition);
  const trimmed = query.trim();

  if (trimmed && entries.length === 0) {
    return (
      <div className="px-4 py-8" data-catalog-list="empty">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {noMatchMessage(screen.subject, trimmed)}
        </p>
        {screen.subject === "tool" ? (
          <Link
            href={catalogHref(screen.slug, "", condition)}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Clear search
          </Link>
        ) : null}
      </div>
    );
  }

  const groups = groupCatalog(screen, entries);

  return (
    <div data-catalog-list="results">
      {groups.map((group) => (
        <section key={group.id} className="border-b border-gray-200 dark:border-gray-800">
          {group.heading ? (
            <h2 className="px-4 pt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {group.heading}
            </h2>
          ) : null}
          {group.headingPending ? (
            <h2 className="px-4 pt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Source pending
            </h2>
          ) : null}
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {group.entries.map((entry) => (
              <CatalogRow
                key={entry.id}
                screen={screen}
                entry={entry}
                query={trimmed}
                condition={condition}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CatalogRow({
  screen,
  entry,
  query,
  condition,
}: {
  screen: CatalogScreen;
  entry: CatalogEntry;
  query: string;
  condition: string | null;
}) {
  const review = entryReviewLine(entry);
  const href = catalogHref(screen.slug, query, condition, entry.id);

  return (
    <li className="flex items-stretch gap-3 px-4 py-3">
      <Link
        href={href}
        className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50"
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {entry.label}
        </span>
        {entry.identity.status === "sourced" ? (
          <span className="text-sm text-gray-700 dark:text-gray-300">{entry.identity.name}</span>
        ) : (
          <SourcePendingBadge />
        )}
        {review.kind !== "pending" ? (
          <span className="hidden text-xs text-gray-500 md:inline dark:text-gray-400">
            {review.line}
          </span>
        ) : null}
      </Link>
      {review.kind !== "pending" && entry.identity.status === "sourced" ? (
        <div className="flex items-center md:hidden">
          <SourceButton
            sourceIds={entry.identity.sourceIds}
            entryId={entry.id}
            reviewLine={review.line}
          />
        </div>
      ) : null}
    </li>
  );
}
