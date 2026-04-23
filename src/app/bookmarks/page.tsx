import { Suspense } from "react";
import { fetchHistoryData } from "@/lib/papers/fetch-history";
import { HistoryFeed } from "@/components/papers/history-feed";
import { PaperCardSkeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const initialData = await fetchHistoryData();

  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
          <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {Array.from({ length: 3 }).map((_, i) => (
                <PaperCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <HistoryFeed initialData={initialData} />
    </Suspense>
  );
}
