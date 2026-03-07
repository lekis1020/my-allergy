import type { Metadata } from "next";
import { ConferenceList } from "@/components/calendar/conference-list";

export const metadata: Metadata = {
  title: "Conference Calendar - My Allergy",
  description:
    "Upcoming allergy, asthma, and immunology conferences and academic meetings worldwide.",
};

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          Conference Calendar
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upcoming allergy & immunology conferences and academic meetings
        </p>
      </div>
      <ConferenceList />
    </div>
  );
}
