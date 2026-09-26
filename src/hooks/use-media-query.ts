"use client";

import { useCallback, useSyncExternalStore } from "react";

interface MediaQueryTarget {
  matchMedia(query: string): {
    matches: boolean;
    addEventListener(type: "change", listener: () => void): void;
    removeEventListener(type: "change", listener: () => void): void;
  };
}

function getBrowserTarget(): MediaQueryTarget | undefined {
  return typeof window === "undefined" ? undefined : window;
}

export function getMediaQuerySnapshot(
  query: string,
  target: MediaQueryTarget | undefined = getBrowserTarget(),
): boolean {
  return target?.matchMedia(query).matches ?? false;
}

export function subscribeToMediaQuery(
  query: string,
  listener: () => void,
  target: MediaQueryTarget | undefined = getBrowserTarget(),
): () => void {
  if (!target) return () => {};

  const mediaQuery = target.matchMedia(query);
  mediaQuery.addEventListener("change", listener);
  return () => mediaQuery.removeEventListener("change", listener);
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToMediaQuery(query, listener),
    [query],
  );
  const getSnapshot = useCallback(() => getMediaQuerySnapshot(query), [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
