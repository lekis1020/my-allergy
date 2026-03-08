import type { Metadata } from "next";
import { ConferenceList } from "@/components/calendar/conference-list";
import { createAnonClient } from "@/lib/supabase/server";
import { CONFERENCES } from "@/lib/constants/conferences";
import type { Conference } from "@/lib/constants/conferences";

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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          Conference Calendar
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upcoming allergy &amp; immunology conferences and academic meetings
        </p>
      </div>
      <ConferenceList conferences={conferences} />
    </div>
  );
}
