"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type GraphView =
  | { kind: "galaxy" }
  | { kind: "topic"; slug: string }
  | { kind: "highlight"; slug: string; focusedPmid: string };

export function parseGraphViewFromQuery(params: URLSearchParams): GraphView {
  const map = params.get("map");
  const focus = params.get("focus");
  if (!map || map === "galaxy") return { kind: "galaxy" };
  if (map.startsWith("topic:")) {
    const slug = map.slice("topic:".length);
    if (!slug) return { kind: "galaxy" };
    if (focus) return { kind: "highlight", slug, focusedPmid: focus };
    return { kind: "topic", slug };
  }
  return { kind: "galaxy" };
}

export function serializeGraphView(view: GraphView): string {
  const p = new URLSearchParams();
  if (view.kind === "galaxy") return "";
  if (view.kind === "topic") {
    p.set("map", `topic:${view.slug}`);
    return p.toString();
  }
  p.set("map", `topic:${view.slug}`);
  p.set("focus", view.focusedPmid);
  return p.toString();
}

/**
 * Drives the relationship-graph panel's view state and keeps it in sync with
 * the URL via `history.replaceState` (no history pollution during exploration).
 *
 * The hook subscribes to the URL on mount so a deep link like
 * `/?map=topic:asthma&focus=12345` restores the right state when the user
 * arrives.
 */
export function useGraphView(): [GraphView, (next: GraphView) => void] {
  const router = useRouter();
  const search = useSearchParams();
  const [view, setView] = useState<GraphView>(() =>
    parseGraphViewFromQuery(new URLSearchParams(search.toString()))
  );

  // Keep state in sync if the URL changes externally (e.g. Back button).
  useEffect(() => {
    setView(parseGraphViewFromQuery(new URLSearchParams(search.toString())));
  }, [search]);

  const update = useCallback(
    (next: GraphView) => {
      setView(next);
      const qs = serializeGraphView(next);
      const target = qs ? `?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", target);
      // Keep Next router's internal state aligned without forcing a fetch.
      router.replace(target, { scroll: false });
    },
    [router]
  );

  return [view, update];
}
