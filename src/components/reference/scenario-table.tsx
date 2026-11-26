import { Badge } from "@/components/ui/badge";
import { getSource } from "@/lib/reference/sources";
import type { ScenarioRow } from "@/lib/reference/types";

const COLUMNS = "sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4";

export function SourcePendingBadge() {
  return (
    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      Source pending
    </Badge>
  );
}

export function ScenarioTable({ rows }: { rows: readonly ScenarioRow[] }) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <div
        className={`hidden border-b border-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:grid dark:border-gray-800 dark:text-gray-400 ${COLUMNS}`}
      >
        <span>Scenario</span>
        <span>Guidance</span>
      </div>
      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {rows.map((row) => (
          <li key={row.id} className={`grid gap-2 px-4 py-4 ${COLUMNS}`}>
            <ScenarioCells row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScenarioCells({ row }: { row: ScenarioRow }) {
  const { answer } = row;

  if (answer.status === "placeholder") {
    return (
      <>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {row.label}
        </p>
        <div>
          <SourcePendingBadge />
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {answer.scenario}
      </p>
      <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <p>{answer.guidance}</p>
        <ul className="space-y-1">
          {answer.sourceIds.map((id) => {
            const source = getSource(id);
            if (!source) {
              throw new Error(`Row ${row.id} cites unknown source ${id}`);
            }
            return (
              <li key={id}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {source.citation}
                </a>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Reviewed by {answer.reviewedBy} on {answer.reviewedOn}
        </p>
      </div>
    </>
  );
}
