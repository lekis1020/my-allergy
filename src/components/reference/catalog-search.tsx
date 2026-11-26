"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { searchLabel } from "@/lib/reference/catalog";
import type { CatalogSubject } from "@/lib/reference/types";

export function CatalogSearch({
  initialQuery,
  condition,
  subject,
}: {
  initialQuery: string;
  condition: string | null;
  subject: CatalogSubject;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const [syncedQuery, setSyncedQuery] = useState(initialQuery);
  const label = searchLabel(subject);

  if (syncedQuery !== initialQuery) {
    setSyncedQuery(initialQuery);
    setValue(initialQuery);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const current = params.get("q") ?? "";
      const next = value.trim();
      if (next === current) return;
      if (next) params.set("q", next);
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [pathname, router, value]);

  return (
    <form action={pathname} method="get" role="search" className="w-full">
      {condition ? <input type="hidden" name="condition" value={condition} /> : null}
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={label}
        placeholder={label}
        autoComplete="off"
        className="h-11"
      />
    </form>
  );
}
