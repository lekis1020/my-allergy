import { getSource } from "@/lib/reference/sources";
import type { SourceId } from "@/lib/reference/types";

export function SourceCitations({
  sourceIds,
  entryId,
}: {
  sourceIds: readonly SourceId[];
  entryId: string;
}) {
  return (
    <ul className="space-y-1 text-sm">
      {sourceIds.map((id) => {
        const source = getSource(id);
        if (!source) {
          throw new Error(`Entry ${entryId} cites unknown source ${id}`);
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
  );
}
