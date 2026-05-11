"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ExternalLink, Loader2 } from "lucide-react";
import type { ProposalWithConference } from "@/app/admin/conferences/page";

interface Props {
  proposals: ProposalWithConference[];
}

export function ConferenceProposalList({ proposals }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (proposals.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        검토할 제안이 없습니다.
      </p>
    );
  }

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/conferences/proposals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {proposals.map((p) => {
        const conf = p.conferences;
        const confidenceClass =
          p.confidence === "high"
            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
            : p.confidence === "medium"
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

        return (
          <div
            key={p.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {conf?.name ?? "(unknown)"}
                </h2>
                {conf?.name_ko && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{conf.name_ko}</p>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceClass}`}
              >
                {p.confidence ?? "low"}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Current</dt>
                <dd className="text-gray-700 dark:text-gray-300">
                  {p.current_start_date && p.current_end_date
                    ? `${p.current_start_date} → ${p.current_end_date}`
                    : "(none)"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Proposed</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {p.proposed_start_date && p.proposed_end_date
                    ? `${p.proposed_start_date} → ${p.proposed_end_date}`
                    : "—"}
                </dd>
              </div>
            </dl>

            {p.reasoning && (
              <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {p.reasoning}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              {p.source_url ? (
                <a
                  href={p.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  <ExternalLink className="h-3 w-3" />
                  source
                </a>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => act(p.id, "reject")}
                  disabled={busyId === p.id}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Reject
                </button>
                <button
                  onClick={() => act(p.id, "approve")}
                  disabled={busyId === p.id}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Approve
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
