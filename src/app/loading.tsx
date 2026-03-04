import { PaperCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <PaperCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
