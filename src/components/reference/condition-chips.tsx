import Link from "next/link";
import { catalogHref, conditionChips } from "@/lib/reference/catalog";
import { cn } from "@/lib/utils/cn";
import type { CatalogScreen } from "@/lib/reference/types";

export function ConditionChips({
  screen,
  query,
  condition,
}: {
  screen: CatalogScreen;
  query: string;
  condition: string | null;
}) {
  const chips = conditionChips(screen);
  if (chips.length === 0) return null;

  return (
    <nav aria-label="Conditions" className="mt-2">
      <ul className="flex gap-2 overflow-x-auto pb-1">
        <li className="shrink-0">
          <Chip href={catalogHref(screen.slug, query, null)} current={condition === null}>
            All
          </Chip>
        </li>
        {chips.map((chip) => (
          <li key={chip} className="shrink-0">
            <Chip href={catalogHref(screen.slug, query, chip)} current={condition === chip}>
              {chip}
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Chip({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-3 text-sm",
        current
          ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200"
          : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900",
      )}
    >
      {children}
    </Link>
  );
}
