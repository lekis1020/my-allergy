"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleAbstractProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleAbstract({
  children,
  defaultOpen = false,
}: CollapsibleAbstractProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between text-sm font-semibold text-gray-900 dark:text-gray-100"
      >
        <span>Original Abstract</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {open && children}
    </section>
  );
}
