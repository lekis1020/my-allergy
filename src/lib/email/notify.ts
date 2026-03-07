import { createServiceClient } from "@/lib/supabase/server";
import {
  getResendClient,
  getFromEmail,
  buildJournalAlertHtml,
  buildKeywordAlertHtml,
} from "./resend";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://my-allergy.vercel.app";

interface NewPaper {
  pmid: string;
  title: string;
  journal_slug: string;
  journal_name: string;
  authors: string;
}

/**
 * Send journal subscription alerts for newly synced papers.
 * Groups papers by journal, then sends one email per user per journal.
 */
export async function sendJournalAlerts(newPapers: NewPaper[]): Promise<{
  sent: number;
  errors: number;
}> {
  if (newPapers.length === 0) return { sent: 0, errors: 0 };

  const supabase = createServiceClient();
  let sent = 0;
  let errors = 0;

  // Get unique journal slugs from new papers
  const journalSlugs = [...new Set(newPapers.map((p) => p.journal_slug))];

  // Find all subscriptions for these journals
  const { data: subscriptions, error: subError } = await supabase
    .from("email_subscriptions")
    .select("user_id, journal_slug")
    .in("journal_slug", journalSlugs);

  if (subError || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, errors: subError ? 1 : 0 };
  }

  // Get user emails
  const userIds = [...new Set(subscriptions.map((s) => s.user_id))];
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const userEmailMap = new Map<string, string>();
  if (usersData?.users) {
    for (const u of usersData.users) {
      if (userIds.includes(u.id) && u.email) {
        userEmailMap.set(u.id, u.email);
      }
    }
  }

  // Group: user -> journal -> papers
  const userJournalPapers = new Map<
    string,
    Map<string, NewPaper[]>
  >();
  for (const sub of subscriptions) {
    const papers = newPapers.filter(
      (p) => p.journal_slug === sub.journal_slug,
    );
    if (papers.length === 0) continue;

    if (!userJournalPapers.has(sub.user_id)) {
      userJournalPapers.set(sub.user_id, new Map());
    }
    userJournalPapers.get(sub.user_id)!.set(sub.journal_slug, papers);
  }

  const resend = getResendClient();
  const from = getFromEmail();

  for (const [userId, journalMap] of userJournalPapers) {
    const email = userEmailMap.get(userId);
    if (!email) continue;

    for (const [, papers] of journalMap) {
      const journalName = papers[0].journal_name;
      try {
        await resend.emails.send({
          from,
          to: email,
          subject: `[My Allergy] ${papers.length} new paper${papers.length > 1 ? "s" : ""} in ${journalName}`,
          html: buildJournalAlertHtml(
            journalName,
            papers.map((p) => ({
              pmid: p.pmid,
              title: p.title,
              authors: p.authors,
              journalName: p.journal_name,
            })),
            BASE_URL,
          ),
        });
        sent++;
      } catch (err) {
        console.error(
          `[Email] Failed to send journal alert to ${email}:`,
          err,
        );
        errors++;
      }
    }
  }

  return { sent, errors };
}

/**
 * Send keyword alerts for newly synced papers.
 * Matches keywords against paper title and abstract (case-insensitive).
 */
export async function sendKeywordAlerts(newPapers: NewPaper[]): Promise<{
  sent: number;
  errors: number;
}> {
  if (newPapers.length === 0) return { sent: 0, errors: 0 };

  const supabase = createServiceClient();
  let sent = 0;
  let errors = 0;

  // Get all active keyword alerts
  const { data: alerts, error: alertError } = await supabase
    .from("keyword_alerts")
    .select("user_id, keyword")
    .eq("active", true);

  if (alertError || !alerts || alerts.length === 0) {
    return { sent: 0, errors: alertError ? 1 : 0 };
  }

  // Get user emails
  const userIds = [...new Set(alerts.map((a) => a.user_id))];
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const userEmailMap = new Map<string, string>();
  if (usersData?.users) {
    for (const u of usersData.users) {
      if (userIds.includes(u.id) && u.email) {
        userEmailMap.set(u.id, u.email);
      }
    }
  }

  // Fetch full paper data (title + abstract) for matching
  const pmids = newPapers.map((p) => p.pmid);
  const { data: fullPapers } = await supabase
    .from("papers")
    .select("pmid, title, abstract")
    .in("pmid", pmids);

  const paperTextMap = new Map<string, string>();
  if (fullPapers) {
    for (const fp of fullPapers) {
      const text =
        `${fp.title || ""} ${fp.abstract || ""}`.toLowerCase();
      paperTextMap.set(fp.pmid, text);
    }
  }

  // Group: user -> keyword -> matched papers
  const userKeywordPapers = new Map<
    string,
    Map<string, NewPaper[]>
  >();

  for (const alert of alerts) {
    const keywordLower = alert.keyword.toLowerCase();
    const matched = newPapers.filter((p) => {
      const text = paperTextMap.get(p.pmid) || p.title.toLowerCase();
      return text.includes(keywordLower);
    });

    if (matched.length === 0) continue;

    if (!userKeywordPapers.has(alert.user_id)) {
      userKeywordPapers.set(alert.user_id, new Map());
    }
    userKeywordPapers.get(alert.user_id)!.set(alert.keyword, matched);
  }

  const resend = getResendClient();
  const from = getFromEmail();

  for (const [userId, keywordMap] of userKeywordPapers) {
    const email = userEmailMap.get(userId);
    if (!email) continue;

    for (const [keyword, papers] of keywordMap) {
      try {
        await resend.emails.send({
          from,
          to: email,
          subject: `[My Allergy] ${papers.length} paper${papers.length > 1 ? "s" : ""} matching "${keyword}"`,
          html: buildKeywordAlertHtml(
            keyword,
            papers.map((p) => ({
              pmid: p.pmid,
              title: p.title,
              authors: p.authors,
              journalName: p.journal_name,
            })),
            BASE_URL,
          ),
        });
        sent++;
      } catch (err) {
        console.error(
          `[Email] Failed to send keyword alert to ${email}:`,
          err,
        );
        errors++;
      }
    }
  }

  return { sent, errors };
}
