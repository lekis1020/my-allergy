import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { ConferenceList } from "@/components/calendar/conference-list";
import { createAnonClient } from "@/lib/supabase/server";
import { CONFERENCES } from "@/lib/constants/conferences";
import type { Conference } from "@/lib/constants/conferences";
import { PageShell } from "@/components/layout/page-shell";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "학회 일정 | My Allergy",
  description:
    "Upcoming allergy, asthma, and immunology conferences and academic meetings worldwide.",
};

export default async function CalendarPage() {
  let conferences: Conference[] = CONFERENCES;

  try {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("conferences")
      .select("*")
      .order("start_date", { ascending: true });

    if (data && data.length > 0) {
      conferences = data.map((c) => ({
        name: c.name,
        nameKo: c.name_ko ?? undefined,
        startDate: c.start_date ?? "",
        endDate: c.end_date ?? "",
        location: c.location ?? "",
        country: c.country ?? "",
        tags: (c.tags as string[]) ?? [],
        website: c.website ?? undefined,
        isKorean: c.is_korean ?? false,
        dateConfirmed: c.date_confirmed ?? true,
      }));
    }
  } catch {
    // fallback to static data
  }

  return (
    <PageShell
      title="Conference Calendar"
      subtitle="Upcoming allergy & immunology conferences"
      icon={<CalendarDays className="h-5 w-5 text-blue-500" />}
      variant="narrow"
    >
      <div className="px-4 py-6">
        <ConferenceList conferences={conferences} />
      </div>
    </PageShell>
  );
}
