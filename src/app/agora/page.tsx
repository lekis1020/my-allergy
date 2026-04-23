import { Suspense } from "react";
import { fetchInitialAgora } from "@/lib/papers/fetch-agora";
import { AgoraFeed } from "@/components/papers/agora-feed";
import { PaperCardSkeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default async function AgoraPage() {
  const initialData = await fetchInitialAgora();

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
      <AgoraFeed initialData={initialData} />
    </Suspense>
  );
}
