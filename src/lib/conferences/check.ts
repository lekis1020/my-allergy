import OpenAI from "openai";

export interface ExtractedConferenceDates {
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null;   // YYYY-MM-DD
  source_url: string | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

export interface ConferenceCheckInput {
  name: string;
  nameKo?: string | null;
  website: string;
  currentStartDate?: string | null;
  currentEndDate?: string | null;
}

const SYSTEM_PROMPT = `You verify the official start and end dates of upcoming medical/scientific conferences from their official websites.

Rules:
- Use the web_search tool to look up the conference's official site (prefer the URL the user gives you).
- Extract only the NEXT upcoming edition's dates (closest future occurrence, or the in-progress edition if it has started but not ended).
- Output ISO-8601 dates (YYYY-MM-DD). If only month is known, return null for the dates and set confidence to "low".
- If the official page clearly shows dates, confidence = "high".
- If dates come from a secondary source or press release, confidence = "medium".
- If you can't find dates or the year is ambiguous, set both dates to null and confidence to "low".
- Return STRICT JSON only — no markdown, no commentary outside the JSON.`;

function buildUserPrompt(input: ConferenceCheckInput): string {
  const today = new Date().toISOString().slice(0, 10);
  const currentLine =
    input.currentStartDate && input.currentEndDate
      ? `Currently stored dates: ${input.currentStartDate} → ${input.currentEndDate}. Confirm these or propose corrections.`
      : "No dates currently stored.";

  return `Conference: ${input.name}${input.nameKo ? ` (${input.nameKo})` : ""}
Official website: ${input.website}
Today's date: ${today}
${currentLine}

Return JSON with this exact shape:
{
  "start_date": "YYYY-MM-DD" | null,
  "end_date": "YYYY-MM-DD" | null,
  "source_url": "https://..." | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "1-2 sentences citing where the dates came from"
}`;
}

export async function extractConferenceDates(
  input: ConferenceCheckInput
): Promise<ExtractedConferenceDates> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model: "gpt-4o",
    tools: [{ type: "web_search_preview" }],
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
  });

  const text = response.output_text?.trim() ?? "";
  const jsonText = extractJson(text);
  if (!jsonText) {
    throw new Error(`No JSON in model output: ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonText) as Partial<ExtractedConferenceDates>;
  return {
    start_date: normalizeDate(parsed.start_date),
    end_date: normalizeDate(parsed.end_date),
    source_url: typeof parsed.source_url === "string" ? parsed.source_url : null,
    confidence:
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "low",
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
  };
}

function extractJson(text: string): string | null {
  // The model may return a fenced block or raw JSON.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
