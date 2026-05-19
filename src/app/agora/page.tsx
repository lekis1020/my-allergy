import { Suspense } from "react";
import { fetchInitialAgora } from "@/lib/papers/fetch-agora";
import { AgoraFeed } from "@/components/papers/agora-feed";
import { PaperCardSkeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

// The data fetch lives in its own async component so the Suspense boundary can
// stream the skeleton immediately. Awaiting in the page component itself would
// block the whole response on the (cookie-bound, uncacheable) Supabase query,
// making the fallback dead code and leaving the viewer on a blank screen.
async function AgoraContent() {
  const initialData = await fetchInitialAgora();
  return <AgoraFeed initialData={initialData} />;
}

function AgoraSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        {Array.from({ length: 5 }).map((_, i) => (
          <PaperCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function AgoraPage() {
  return (
    <Suspense fallback={<AgoraSkeleton />}>
      <AgoraContent />
    </Suspense>
  );
}
