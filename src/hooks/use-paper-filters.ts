"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { PaperFilters } from "@/types/filters";

export function usePaperFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: PaperFilters = useMemo(
    () => ({
      q: searchParams.get("q") || undefined,
      journals: searchParams.get("journals")?.split(",").filter(Boolean) || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      sort: (searchParams.get("sort") as PaperFilters["sort"]) || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined,
    }),
    [searchParams]
  );

  const setFilters = useCallback(
    (newFilters: Partial<PaperFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(newFilters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(","));
          } else {
            params.delete(key);
          }
        } else {
          params.set(key, String(value));
        }
      });

      // Reset page when filters change (unless page itself is being set)
      if (!("page" in newFilters)) {
        params.delete("page");
      }

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const clearFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  const hasActiveFilters = useMemo(
    () => !!(filters.q || filters.journals?.length || filters.from || filters.to),
    [filters]
  );

  return { filters, setFilters, clearFilters, hasActiveFilters };
}
