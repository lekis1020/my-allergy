"use client";

import { useState } from "react";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";

interface PaperAbstractProps {
  abstract: string | null;
  maxLength?: number;
  hideWhenCollapsed?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  showToggle?: boolean;
}

export function PaperAbstract({
  abstract,
  maxLength = 250,
  hideWhenCollapsed = false,
  expanded,
  onToggle,
  showToggle = true,
}: PaperAbstractProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const currentExpanded = expanded ?? internalExpanded;
  const decodedAbstract = abstract ? decodeHtmlEntities(abstract) : null;

  if (!decodedAbstract) {
    return (
      <p className="text-sm text-gray-400 italic dark:text-gray-500">
        No abstract available
      </p>
    );
  }

  const isLong = decodedAbstract.length > maxLength;
  const displayText = hideWhenCollapsed
    ? decodedAbstract
    : currentExpanded || !isLong
      ? decodedAbstract
      : decodedAbstract.slice(0, maxLength).trimEnd() + "...";
  const sections = parseAbstractSections(displayText);
  const handleToggle = () => {
    if (onToggle) {
      onToggle();
      return;
    }
    setInternalExpanded((prev) => !prev);
  };

  return (
    <div>
      {(!hideWhenCollapsed || currentExpanded) && (
        <div className="space-y-2">
          {sections.map((section, index) => {
            const headingMeta = section.heading ? getHeadingMeta(section.heading) : null;

            return (
              <p
                key={`${section.heading ?? "plain"}-${index}`}
                className="text-sm leading-relaxed text-gray-600 dark:text-gray-300"
              >
                {headingMeta && (
                  <span
                    className={`mr-1.5 inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${headingMeta.className}`}
                  >
                    {headingMeta.label}
                  </span>
                )}
                <span className="whitespace-pre-line">{section.body}</span>
              </p>
            );
          })}
        </div>
      )}

      {showToggle && (hideWhenCollapsed || isLong) && (
        <button
          onClick={handleToggle}
          className="mt-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {hideWhenCollapsed
            ? currentExpanded
              ? "Hide abstract"
              : "Show abstract"
            : currentExpanded
              ? "Show less"
              : "Show more"}
        </button>
      )}
    </div>
  );
}

interface AbstractSection {
  heading: string | null;
  body: string;
}

function parseAbstractSections(text: string): AbstractSection[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: AbstractSection[] = [];

  for (const line of lines) {
    const parsed = parseHeadingLine(line);
    if (parsed) {
      sections.push(parsed);
      continue;
    }

    const previous = sections[sections.length - 1];
    if (previous && previous.heading === null) {
      previous.body = `${previous.body} ${line}`.trim();
    } else {
      sections.push({ heading: null, body: line });
    }
  }

  return sections.length > 0 ? sections : [{ heading: null, body: text }];
}

function parseHeadingLine(line: string): AbstractSection | null {
  const match = line.match(/^([A-Za-z][A-Za-z0-9\s/\-()]{1,40}):\s*(.+)$/);
  if (!match) return null;

  const heading = normalizeHeading(match[1]);
  const body = match[2].trim();
  if (!body) return null;

  return { heading, body };
}

function normalizeHeading(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

function getHeadingMeta(heading: string): { label: string; className: string } {
  const normalized = heading.toLowerCase();

  if (/background/.test(normalized)) {
    return {
      label: "Background",
      className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    };
  }

  if (/objective|aim/.test(normalized)) {
    return {
      label: "Objective",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    };
  }

  if (/method|design|patient|intervention/.test(normalized)) {
    return {
      label: "Methods",
      className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    };
  }

  if (/result|finding/.test(normalized)) {
    return {
      label: "Results",
      className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    };
  }

  if (/conclusion|interpretation|summary|implication/.test(normalized)) {
    return {
      label: "Conclusion",
      className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    };
  }

  return {
    label: toTitleCase(normalized),
    className: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  };
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
