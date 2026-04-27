import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePaperSummary } from "@/lib/gemini/summarize";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { limit = 50 } = await req.json().catch(() => ({}));
  const supabase = createServiceClient();

  const { data: papers } = await supabase
    .from("papers")
    .select("pmid, abstract")
    .is("ai_summary", null)
    .not("abstract", "is", null)
    .order("publication_date", { ascending: false })
    .limit(Math.min(limit, 100));

  let generated = 0;
  for (const paper of papers ?? []) {
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
    total: papers?.length ?? 0,
    generated,
    remaining: (papers?.length ?? 0) - generated,
  });
}
