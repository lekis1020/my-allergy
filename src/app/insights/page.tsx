import type { Metadata } from "next";
import { InsightsView } from "@/components/insights/insights-view";

export const metadata: Metadata = {
  title: "Insights | My Allergy",
  description: "Author geography and research leader insights in allergy & immunology",
};

export default function InsightsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 pb-24 md:pb-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Research Insights
      </h1>
      <InsightsView />
    </main>
  );
}
