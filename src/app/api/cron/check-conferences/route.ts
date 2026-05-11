import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { extractConferenceDates } from "@/lib/conferences/check";
import { sendDiscordMessage } from "@/lib/notifications/discord";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export const dynamic = "force-dynamic";
export const maxDuration = 300; // up to 5 min — many LLM calls

interface ConferenceRow {
  id: string;
  name: string;
  name_ko: string | null;
  website: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface PendingProposalRow {
  conference_id: string;
}

interface ProposalSummary {
  conference: string;
  current: string;
  proposed: string;
  confidence: "high" | "medium" | "low";
  source_url: string | null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Only check conferences with a website AND whose stored end_date is in the
  // future or unknown. Past conferences don't need rechecking.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conferences, error } = await (supabase.from("conferences") as any)
    .select("id, name, name_ko, website, start_date, end_date")
    .not("website", "is", null)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("start_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (conferences ?? []) as ConferenceRow[];

  // Skip conferences that already have a pending proposal.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pending } = await ((supabase as any).from("conference_proposals"))
    .select("conference_id")
    .eq("status", "pending");
  const pendingSet = new Set((pending as PendingProposalRow[] | null ?? []).map((p) => p.conference_id));

  const proposals: ProposalSummary[] = [];
  const errors: Array<{ name: string; error: string }> = [];
  let checked = 0;

  for (const row of rows) {
    if (pendingSet.has(row.id)) continue;
    if (!row.website) continue;
    checked += 1;

    try {
      const result = await extractConferenceDates({
        name: row.name,
        nameKo: row.name_ko,
        website: row.website,
        currentStartDate: row.start_date,
        currentEndDate: row.end_date,
      });

      if (!result.start_date || !result.end_date) continue;

      const datesChanged =
        result.start_date !== row.start_date || result.end_date !== row.end_date;
      if (!datesChanged) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await ((supabase as any).from("conference_proposals")).insert({
        conference_id: row.id,
        current_start_date: row.start_date,
        current_end_date: row.end_date,
        proposed_start_date: result.start_date,
        proposed_end_date: result.end_date,
        source_url: result.source_url,
        confidence: result.confidence,
        reasoning: result.reasoning,
        status: "pending",
      });
      if (insertError) {
        errors.push({ name: row.name, error: insertError.message });
        continue;
      }

      proposals.push({
        conference: row.name,
        current:
          row.start_date && row.end_date
            ? `${row.start_date} → ${row.end_date}`
            : "(none)",
        proposed: `${result.start_date} → ${result.end_date}`,
        confidence: result.confidence,
        source_url: result.source_url,
      });
    } catch (err) {
      errors.push({ name: row.name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (proposals.length > 0) {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      `https://${process.env.VERCEL_URL ?? "my-allergy.vercel.app"}`;
    await sendDiscordMessage({
      content: `**학회 일정 변경 제안 ${proposals.length}건** — <${baseUrl}/admin/conferences>`,
      embeds: proposals.slice(0, 10).map((p) => ({
        title: p.conference,
        url: p.source_url ?? undefined,
        color: p.confidence === "high" ? 0x22c55e : p.confidence === "medium" ? 0xeab308 : 0x9ca3af,
        fields: [
          { name: "Current", value: p.current, inline: true },
          { name: "Proposed", value: p.proposed, inline: true },
          { name: "Confidence", value: p.confidence, inline: true },
        ],
      })),
    });
  }

  return NextResponse.json({
    success: true,
    checked,
    new_proposals: proposals.length,
    errors,
  });
}
