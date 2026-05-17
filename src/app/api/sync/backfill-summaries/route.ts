import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePaperSummary } from "@/lib/gemini/summarize";

// Allow up to 5 minutes — each summary is throttled ~1s to respect the
// Gemini rate limit, so a batch of 100 needs well over the default limit.
export const maxDuration = 300;

// Stop starting new summaries past this point so the handler returns a
// clean JSON response (with `remaining`) instead of a hard timeout.
const TIME_BUDGET_MS = 270_000;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const { limit = 50 } = await req.json().catch(() => ({}));
  const supabase = createServiceClient();

  const { data: papers } = await supabase
    .from("papers")
    .select("pmid, abstract")
    .is("ai_summary", null)
    .not("abstract", "is", null)
    .order("publication_date", { ascending: false })
    .limit(Math.min(limit, 100));

  const list = papers ?? [];
  let processed = 0;
  let generated = 0;

  for (const paper of list) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    processed++;

    const summary = await generatePaperSummary(paper.abstract);
    if (summary) {
      await supabase
        .from("papers")
        .update({ ai_summary: summary })
        .eq("pmid", paper.pmid);
      generated++;
    }
    // Rate limit: ~1 req/sec
    await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({
    fetched: list.length,
    processed,
    generated,
    // Papers fetched in this batch that still lack a summary (timed-out
    // tail + generation failures). Re-call until this reaches 0.
    remaining: list.length - generated,
    timed_out: processed < list.length,
  });
}
