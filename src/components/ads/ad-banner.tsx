"use client";

import { useEffect, useRef } from "react";

type AdVariant = "feed-inline" | "right-rail";

interface AdBannerProps {
  variant: AdVariant;
  className?: string;
}

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

  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "";
  const slotId = variant === "feed-inline"
    ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED ?? ""
    : process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ?? "";

  useEffect(() => {
    if (pushed.current || !clientId || !slotId) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet — silently ignore
    }
  }, [clientId, slotId]);

  const config = SLOT_CONFIG[variant];

  if (!clientId || !slotId) {
    return <AdBannerFallback variant={variant} className={className} />;
  }

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
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format={config.format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

/** Fallback shown when AdSense env vars are not configured */
function AdBannerFallback({ variant, className = "" }: AdBannerProps) {
  if (variant === "feed-inline") {
    return (
      <div className={`border-b border-gray-200 bg-blue-50/40 px-4 py-4 dark:border-gray-800 dark:bg-blue-950/20 ${className}`}>
        <p className="mb-1.5 text-[11px] font-medium tracking-wide text-gray-400 dark:text-gray-500">
          Sponsored
        </p>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Allergy Research Conference 2026
        </p>
        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          Join 5,000+ researchers at the Global Allergy &amp; Immunology Summit. Early-bird registration now open.
        </p>
        <button className="mt-2.5 rounded-full bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600">
          Learn more
        </button>
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <p className="mb-2 text-[11px] font-medium tracking-wide text-gray-400 dark:text-gray-500">
        Sponsored
      </p>
      <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/30">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          AI-Powered Literature Review
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          Summarize 100+ papers in minutes. Try free for 14 days.
        </p>
        <button className="mt-3 rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-600">
          Start free trial
        </button>
      </div>
    </section>
  );
}
