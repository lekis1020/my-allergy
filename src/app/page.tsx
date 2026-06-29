import { Suspense } from "react";
import { fetchInitialPapers } from "@/lib/papers/fetch-initial";
import { HomePage } from "@/components/papers/home-page";
import { PaperCardSkeleton } from "@/components/ui/skeleton";

// Timeline data is refreshed by a 6-hour sync cron, so the page does not need
// to be re-rendered on every request. Revalidate the cached render every 10
// minutes; per-user bookmark/like state is layered in client-side via SWR.
export const revalidate = 600;

export default function Page() {
  // Stream the static shell + skeleton immediately and let the feed resolve
  // inside the Suspense boundary, so a slow (cold/regenerating) DB query no
  // longer blocks the whole page render before any bytes are sent.
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
          <div className="border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            {Array.from({ length: 5 }).map((_, i) => (
              <PaperCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <TimelineFeed />
    </Suspense>
  );
}

async function TimelineFeed() {
  const initialData = await fetchInitialPapers();
  return <HomePage initialData={initialData} />;
}
