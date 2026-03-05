"use client";

import { Megaphone } from "lucide-react";

type AdVariant = "feed-inline" | "right-rail";

interface AdBannerProps {
  variant: AdVariant;
  className?: string;
}

const AD_CONTENT = {
  "feed-inline": {
    title: "Allergy Research Conference 2026",
    description:
      "Join 5,000+ researchers at the Global Allergy & Immunology Summit. Early-bird registration now open.",
    cta: "Learn more",
    accent: "blue",
  },
  "right-rail": {
    title: "AI-Powered Literature Review",
    description: "Summarize 100+ papers in minutes. Try free for 14 days.",
    cta: "Start free trial",
    accent: "indigo",
  },
} as const;

export function AdBanner({ variant, className = "" }: AdBannerProps) {
  const content = AD_CONTENT[variant];

  if (variant === "feed-inline") {
    return (
      <div className={`border-b border-gray-200 bg-blue-50/40 px-4 py-4 dark:border-gray-800 dark:bg-blue-950/20 ${className}`}>
        <div className="mb-1.5 flex items-center gap-1.5">
          <Megaphone className="h-3 w-3 text-gray-400 dark:text-gray-500" />
          <span className="text-[11px] font-medium tracking-wide text-gray-400 dark:text-gray-500">
            Sponsored
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {content.title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {content.description}
        </p>
        <button className="mt-2.5 rounded-full bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600">
          {content.cta}
        </button>
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <Megaphone className="h-3 w-3 text-gray-400 dark:text-gray-500" />
        <span className="text-[11px] font-medium tracking-wide text-gray-400 dark:text-gray-500">
          Sponsored
        </span>
      </div>
      <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/30">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {content.title}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          {content.description}
        </p>
        <button className="mt-3 rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-600">
          {content.cta}
        </button>
      </div>
    </section>
  );
}
