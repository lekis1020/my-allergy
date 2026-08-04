"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, X } from "lucide-react";
import { TOPIC_TREE } from "@/lib/constants/topics";
import { JOURNALS } from "@/lib/constants/journals";

export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const openSearch = () => {
    // Read q directly from the URL instead of useSearchParams: this component
    // lives in the root-layout Header, and useSearchParams there would force a
    // Suspense boundary around every page.
    setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    setOpen(true);
  };

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  const submit = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setOpen(false);
    router.push(`/?q=${encodeURIComponent(clean)}`);
  };

  const goJournal = (slug: string) => {
    setOpen(false);
    router.push(`/?journals=${encodeURIComponent(slug)}`);
  };

  return (
    <>
      <button
        onClick={openSearch}
        className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 lg:hidden"
        aria-label="Search papers"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Portal to body: the sticky header uses backdrop-blur, whose
          backdrop-filter turns it into the containing block for fixed
          descendants — rendered inline, inset-0 would only span the header. */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-white dark:bg-gray-950"
          role="dialog"
          aria-modal="true"
          aria-label="Search papers"
        >
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-800">
            <button
              onClick={close}
              className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Close search"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit(query);
                }}
                placeholder="Search topic, PMID, DOI"
                enterKeyHint="search"
                className="h-10 w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-10 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-600 dark:focus:ring-blue-950"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Clear query"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Topics
            </p>
            <div className="flex flex-wrap gap-2">
              {TOPIC_TREE.map((category) => (
                <button
                  key={category.id}
                  onClick={() => submit(category.searchQuery)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${category.colorClass.replace("text-", "bg-")}`}
                  />
                  {category.label}
                </button>
              ))}
            </div>

            <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Journals
            </p>
            <div className="flex flex-wrap gap-2">
              {JOURNALS.map((journal) => (
                <button
                  key={journal.slug}
                  onClick={() => goJournal(journal.slug)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ backgroundColor: `${journal.color}1A`, color: journal.color }}
                >
                  {journal.abbreviation}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
