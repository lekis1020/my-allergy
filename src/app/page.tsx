import { Suspense } from "react";
import { fetchInitialPapers } from "@/lib/papers/fetch-initial";
import { HomePage } from "@/components/papers/home-page";
import { PaperCardSkeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default async function Page() {
  const initialData = await fetchInitialPapers();

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
      <HomePage initialData={initialData} />
    </Suspense>
  );
}
