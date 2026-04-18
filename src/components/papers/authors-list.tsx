import { decodeHtmlEntities } from "@/lib/utils/html-entities";

interface AuthorData {
  last_name: string;
  first_name: string | null;
  initials: string | null;
  affiliation: string | null;
  position: number;
}

interface AuthorsListProps {
  authors: AuthorData[];
  collapseThreshold?: number;
}

function AuthorRow({ author }: { author: AuthorData }) {
  return (
    <div className="text-sm">
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
  );
}

/**
 * Server-compatible collapsible author list using native <details>.
 * When authors.length <= collapseThreshold, renders all inline.
 * Otherwise shows first 3 + a <details> toggle revealing the rest.
 */
export function AuthorsList({ authors, collapseThreshold = 10 }: AuthorsListProps) {
  const shouldCollapse = authors.length > collapseThreshold;

  if (!shouldCollapse) {
    return (
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Authors
        </h2>
        <div className="space-y-1">
          {authors.map((a, i) => (
            <AuthorRow key={i} author={a} />
          ))}
        </div>
      </section>
    );
  }

  const visible = authors.slice(0, 3);
  const hidden = authors.slice(3);
  const lastAuthor = authors[authors.length - 1];

  return (
    <section>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 select-none">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Authors
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              {authors.length} authors
            </span>
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-gray-100">
            <span className="group-open:hidden">Show all</span>
            <span className="hidden group-open:inline">Collapse</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className="transition-transform group-open:rotate-180"
              aria-hidden
            >
              <path
                d="M2 3 L5 7 L8 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </summary>

        {/* Preview row visible only when collapsed */}
        <div className="mt-2 space-y-1 group-open:hidden">
          {visible.map((a, i) => (
            <AuthorRow key={i} author={a} />
          ))}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            …{authors.length - 4 > 0 ? ` ${authors.length - 4} more,` : ""} and{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {lastAuthor.last_name}
              {lastAuthor.first_name && `, ${lastAuthor.first_name}`}
            </span>
          </p>
        </div>

        {/* Full list visible only when expanded */}
        <div className="mt-2 space-y-1 hidden group-open:block">
          {visible.map((a, i) => (
            <AuthorRow key={`v-${i}`} author={a} />
          ))}
          {hidden.map((a, i) => (
            <AuthorRow key={`h-${i}`} author={a} />
          ))}
        </div>
      </details>
    </section>
  );
}
