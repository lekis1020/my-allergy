"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useMediaQuery } from "@/hooks/use-media-query";
import { scheduleAfterIdle } from "@/lib/browser/scheduling";

const RightRail = dynamic(
  () => import("@/components/layout/right-rail").then((module) => ({ default: module.RightRail })),
  { ssr: false },
);

interface ResponsiveRightRailProps {
  total: number;
}

/** Matches Tailwind's default `xl` breakpoint used by the home-page rail column. */
export const RESPONSIVE_RIGHT_RAIL_QUERY = "(min-width: 80rem)";

export function ResponsiveRightRail({ total }: ResponsiveRightRailProps) {
  const isWideViewport = useMediaQuery(RESPONSIVE_RIGHT_RAIL_QUERY);

  if (!isWideViewport) return null;

  return <IdleRightRail total={total} />;
}

function IdleRightRail({ total }: ResponsiveRightRailProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => scheduleAfterIdle(() => setIsReady(true), window), []);

  return isReady ? <RightRail total={total} /> : null;
}
