import { redirect } from "next/navigation";
import { createServerAuthClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/admin";
import { ConferenceProposalList } from "@/components/admin/conference-proposal-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Conference Proposals | My Allergy",
};

export interface ProposalWithConference {
  id: string;
  conference_id: string;
  current_start_date: string | null;
  current_end_date: string | null;
  proposed_start_date: string | null;
  proposed_end_date: string | null;
  source_url: string | null;
  confidence: "high" | "medium" | "low" | null;
  reasoning: string | null;
  status: string;
  created_at: string;
  conferences: { name: string; name_ko: string | null; website: string | null } | null;
}

export default async function ConferenceProposalsPage() {
  const auth = await createServerAuthClient();
  const { data: { session } } = await auth.auth.getSession();
  if (!session?.user || !isAdmin(session.user.email)) {
    redirect("/");
  }

  const service = createServiceClient();
  const { data } = await service.from("conference_proposals")
    .select(
      `id, conference_id, current_start_date, current_end_date,
       proposed_start_date, proposed_end_date, source_url, confidence,
       reasoning, status, created_at,
       conferences (name, name_ko, website)`
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const proposals = (data ?? []) as ProposalWithConference[];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
        Conference Date Proposals
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        주 1회 자동으로 수집된 학회 일정 변경 후보입니다. 검토 후 승인 또는 거부하세요.
      </p>
      <div className="mt-6">
        <ConferenceProposalList proposals={proposals} />
      </div>
    </div>
  );
}
