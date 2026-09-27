interface FeedEndObserverOptions {
  hasMore: boolean;
  isLoadingMore: boolean;
  thresholdPixels: number;
  onLoadMore: () => void;
}

export function observeFeedEnd(
  sentinel: Element,
  { hasMore, isLoadingMore, thresholdPixels, onLoadMore }: FeedEndObserverOptions,
): () => void {
  let loadRequested = false;

  const observer = new IntersectionObserver(
    (entries) => {
      if (
        loadRequested ||
        !hasMore ||
        isLoadingMore ||
        !entries.some((entry) => entry.isIntersecting)
      ) {
        return;
      }

      loadRequested = true;
      onLoadMore();
    },
    { rootMargin: `0px 0px ${thresholdPixels}px 0px` },
  );

  observer.observe(sentinel);
  return () => observer.disconnect();
}
