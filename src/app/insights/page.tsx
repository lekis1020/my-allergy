import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { InsightsView } from "@/components/insights/insights-view";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Insights | My Allergy",
  description: "Author geography and research leader insights in allergy & immunology",
};

export default function InsightsPage() {
  return (
    <PageShell
      title="Research Insights"
      subtitle="Author geography & research leaders"
      icon={<BarChart3 className="h-5 w-5 text-violet-500" />}
      variant="narrow"
    >
      <div className="px-4 py-6">
        <InsightsView />
      </div>
    </PageShell>
  );
}
