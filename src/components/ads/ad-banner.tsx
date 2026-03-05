"use client";

import { useEffect, useRef } from "react";

type AdVariant = "feed-inline" | "right-rail";

interface AdBannerProps {
  variant: AdVariant;
  className?: string;
}

const ADSENSE_CLIENT_ID = "ca-pub-8245767086450488";

const SLOT_CONFIG: Record<AdVariant, { format: string; style: React.CSSProperties }> = {
  "feed-inline": {
    format: "fluid",
    style: { display: "block", textAlign: "center" as const, minHeight: 100 },
  },
  "right-rail": {
    format: "auto",
    style: { display: "block", minHeight: 250 },
  },
};

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export function AdBanner({ variant, className = "" }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  const slotId = variant === "feed-inline"
    ? (process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED ?? "")
    : (process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ?? "");

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet — silently ignore
    }
  }, []);

  const config = SLOT_CONFIG[variant];

  const wrapperClass = variant === "feed-inline"
    ? `border-b border-gray-200 bg-gray-50/50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/30 ${className}`
    : `rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 ${className}`;

  return (
    <div className={wrapperClass}>
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-gray-400 dark:text-gray-500">
        Sponsored
      </p>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={config.style}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId || undefined}
        data-ad-format={config.format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
