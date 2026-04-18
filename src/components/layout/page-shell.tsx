import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  variant?: "feed" | "wide" | "narrow";
  stickyHeader?: boolean;
}

const VARIANT_CLASSES = {
  feed: "mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4",
  wide: "mx-auto w-full max-w-7xl px-4 py-6",
  narrow: "mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4",
} as const;

const INNER_CLASSES = {
  feed: "border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
  wide: "",
  narrow: "mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
} as const;

export function PageShell({
  title,
  subtitle,
  icon,
  children,
  variant = "feed",
  stickyHeader = true,
}: PageShellProps) {
  const headerBlock = (
    <div
      className={`border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90 ${
        stickyHeader ? "sticky top-14 z-20" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          {title}
        </h1>
        {subtitle && (
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className={VARIANT_CLASSES[variant]}>
      <div className={INNER_CLASSES[variant]}>
        {headerBlock}
        {children}
      </div>
    </div>
  );
}
