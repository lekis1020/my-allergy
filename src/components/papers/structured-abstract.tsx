interface StructuredAbstractProps {
  text: string;
}

interface Section {
  heading: string | null;
  body: string;
}

const HEADING_LABELS: Record<string, string> = {
  background: "Background",
  introduction: "Introduction",
  "purpose": "Purpose",
  "rationale": "Rationale",
  "objective": "Objective",
  "objectives": "Objectives",
  "aim": "Aim",
  "aims": "Aims",
  "methods": "Methods",
  "method": "Methods",
  "materials and methods": "Materials and Methods",
  "study design": "Study Design",
  "design": "Design",
  "patients": "Patients",
  "patients and methods": "Patients and Methods",
  "subjects and methods": "Subjects and Methods",
  "intervention": "Intervention",
  "interventions": "Interventions",
  "measurements": "Measurements",
  "results": "Results",
  "findings": "Findings",
  "main results": "Main Results",
  "outcome": "Outcome",
  "outcomes": "Outcomes",
  "conclusion": "Conclusion",
  "conclusions": "Conclusions",
  "interpretation": "Interpretation",
  "summary": "Summary",
  "implications": "Implications",
  "clinical implications": "Clinical Implications",
  "significance": "Significance",
  "clinical relevance": "Clinical Relevance",
  "trial registration": "Trial Registration",
  "funding": "Funding",
};

function parseStructuredAbstract(text: string): Section[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: Section[] = [];

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

function parseHeadingLine(line: string): Section | null {
  const match = line.match(/^([A-Za-z][A-Za-z0-9\s/\-()&,]{1,45}):\s*(.+)$/);
  if (!match) return null;

  const rawHeading = match[1].trim();
  const normalized = rawHeading.toLowerCase().replace(/\s+/g, " ");

  // Only accept known section headings to avoid false positives
  if (!(normalized in HEADING_LABELS) && !Object.values(HEADING_LABELS).some(
    (label) => label.toLowerCase() === normalized
  )) {
    // Also accept if it's close to a known heading
    const isKnownPattern = /^(background|intro|object|aim|purpose|method|design|patient|subject|result|finding|outcome|conclusion|interpret|summar|implic|signific|funding|trial)/i.test(normalized);
    if (!isKnownPattern) return null;
  }

  const body = match[2].trim();
  if (!body) return null;

  const label = HEADING_LABELS[normalized] ?? toTitleCase(rawHeading);
  return { heading: label, body };
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function StructuredAbstract({ text }: StructuredAbstractProps) {
  const sections = parseStructuredAbstract(text);
  const isStructured = sections.some((s) => s.heading !== null);

  if (!isStructured) {
    return (
      <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        {text}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div key={index}>
          {section.heading && (
            <h3 className="mb-1 text-sm font-bold text-gray-900 dark:text-gray-100">
              {section.heading}
            </h3>
          )}
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {section.body}
          </p>
        </div>
      ))}
    </div>
  );
}
